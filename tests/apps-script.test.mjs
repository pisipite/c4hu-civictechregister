import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { createContext, runInContext } from 'node:vm';
import { parseCsv } from '../dist/csv.js';

const source = await readFile(new URL('../backend/google-apps-script/Code.gs', import.meta.url), 'utf8');

function harness({ configured = true } = {}) {
  const properties = new Map(configured ? [['VOTES_SPREADSHEET_ID', 'private-test-sheet'], ['VOTER_SALT', 'private-test-salt']] : []);
  const cache = new Map();
  const rows = configured ? [['project_id', 'voter_hash', 'created_at']] : [];
  let held = false, created = 0;
  const lock = {
    waitLock() { assert.equal(held, false); held = true; },
    tryLock() { if (held) return false; held = true; return true; },
    releaseLock() { held = false; },
  };
  const sheet = {
    setName() { return sheet; }, setFrozenRows() {},
    appendRow(row) { assert.equal(held, true); rows.push([...row]); },
    getLastRow() { assert.equal(held, true); return rows.length; },
    getRange(start, _column, count) { return { getValues: () => rows.slice(start - 1, start - 1 + count).map(row => [...row]) }; },
    deleteRow(index) { assert.equal(held, true); rows.splice(index - 1, 1); },
  };
  const spreadsheet = { getSheets: () => [sheet], getId: () => 'private-test-sheet', getSheetByName: () => sheet };
  const context = createContext({
    console: { log() {}, error() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties.get(key), setProperties: values => Object.entries(values).forEach(([key, value]) => properties.set(key, value)) }) },
    LockService: { getScriptLock: () => lock },
    SpreadsheetApp: { create() { created += 1; return spreadsheet; }, openById: () => spreadsheet, flush() { assert.equal(held, true); } },
    CacheService: { getScriptCache: () => ({ get: key => cache.get(key), put: (key, value) => cache.set(key, value) }) },
    Utilities: { getUuid: randomUUID, parseCsv, DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' }, computeDigest: (algorithm, value, encoding) => [...createHash(algorithm).update(value, encoding).digest()] },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => 'Azonosító,Név,Aktív\nalpha,Alfa,igen\nbeta,Béta,igen\nhidden,Rejtett,nem\n,Új példa,igen' }) },
    ContentService: { MimeType: { JSON: 'application/json' }, createTextOutput: text => ({ text, setMimeType() { return this; } }) },
  });
  runInContext(source, context, { filename: 'Code.gs' });
  return {
    send: parameters => JSON.parse(context.doPost({ parameter: parameters, postData: { length: 100 } }).text),
    setup: () => context.setup(), rows, properties, context,
    get held() { return held; }, get created() { return created; },
  };
}

test('Apps Script setup creates one separate store and never overwrites it on rerun', () => {
  const api = harness({ configured: false });
  assert.equal(api.send({ action: 'list', projectIds: '["alpha"]' }).ok, false);
  api.setup();
  api.setup();
  assert.equal(api.created, 1);
  assert.equal(api.rows.length, 1);
  assert.equal(api.properties.has('VOTER_SALT'), true);
  assert.equal(api.held, false);
});

test('the actual Apps Script API deduplicates votes and supports withdrawal and anonymous totals', () => {
  const api = harness();
  const a = randomUUID(), b = randomUUID();
  const vote = (voterId, liked) => api.send({ action: 'set', projectId: 'alpha', voterId, liked: String(liked) });
  assert.deepEqual(vote(a, true).projects, [{ id: 'alpha', count: 1, liked: true }]);
  assert.equal(vote(a, true).projects[0].count, 1);
  assert.equal(vote(b, true).projects[0].count, 2);
  assert.deepEqual(vote(a, false).projects, [{ id: 'alpha', count: 1, liked: false }]);
  assert.equal(vote(a, false).projects[0].count, 1);
  const publicResult = api.send({ action: 'list', projectIds: '["alpha","beta"]' });
  assert.deepEqual(publicResult.projects, [{ id: 'alpha', count: 1, liked: false }, { id: 'beta', count: 0, liked: false }]);
  assert.equal(JSON.stringify(api.rows).includes(b), false);
  assert.equal(JSON.stringify(publicResult).includes(api.rows[1][1]), false);
  assert.equal(api.held, false);
});

test('Apps Script rejects unknown/inactive projects, bad identities and malformed payloads', () => {
  const api = harness();
  const voterId = randomUUID();
  for (const parameters of [
    { action: 'set', projectId: 'hidden', voterId, liked: 'true' },
    { action: 'set', projectId: 'missing', voterId, liked: 'true' },
    { action: 'set', projectId: 'alpha', voterId: 'forged', liked: 'true' },
    { action: 'set', projectId: 'alpha', voterId, liked: '100' },
    { action: 'list', projectIds: '["alpha","alpha"]' },
    { action: 'list', projectIds: '{}' },
  ]) assert.equal(api.send(parameters).ok, false);
  assert.equal(api.rows.length, 1);
  assert.equal(api.held, false);
  assert.equal(api.send({ action: 'set', projectId: 'uj-pelda', voterId, liked: 'true' }).ok, true);
});

test('Apps Script internal errors expose no spreadsheet identifiers and always release the lock', () => {
  const api = harness();
  api.context.SpreadsheetApp.openById = () => { throw new Error('private-test-sheet: internal details'); };
  const result = api.send({ action: 'list', projectIds: '["alpha"]' });
  assert.equal(result.ok, false);
  assert.doesNotMatch(result.error, /private-test-sheet|internal details/);
  assert.equal(api.held, false);
});

test('Apps Script limits repeated changes without blocking idempotent retries', () => {
  const api = harness();
  const voterId = randomUUID();
  const vote = liked => api.send({ action: 'set', projectId: 'alpha', voterId, liked: String(liked) });
  for (let index = 0; index < 30; index += 1) assert.equal(vote(index % 2 === 0).ok, true);
  assert.equal(vote(false).ok, true);
  assert.equal(vote(true).ok, false);
  assert.equal(api.rows.length, 1);
  assert.equal(api.held, false);
});
