import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLocalLikesStore } from '../scripts/likes-store.mjs';
import { createLikesClient, compareLikes, likesEndpoint } from '../dist/likes.js';

const params = (action, extra = {}) => new URLSearchParams({ action, ...extra });
const storage = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'c4hu-likes-test-'));
  t.after(async () => {
    await rm(join(directory, 'likes.json'), { force: true });
    await rm(join(directory, 'likes.json.tmp'), { force: true });
    await rmdir(directory);
  });
  const file = join(directory, 'likes.json');
  const allowed = async () => new Set(['alpha', 'beta']);
  const store = createLocalLikesStore(file, allowed);
  const fetch = async (_url, options) => ({ ok: true, json: () => store(options.body) });
  return { store, file, allowed, fetch };
}

test('only local previews use a local counter without a configured backend', () => {
  assert.equal(likesEndpoint('', { hostname: '127.0.0.1' }), './api/likes');
  assert.equal(likesEndpoint('', { hostname: 'pisipite.github.io' }), '');
  assert.equal(likesEndpoint('https://votes.example/api', { hostname: 'pisipite.github.io' }), 'https://votes.example/api');
  assert.throws(() => likesEndpoint('http://votes.example', {}));
  assert.throws(() => likesEndpoint('https://name:password@votes.example', {}));
});

test('different browsers share totals; duplicate requests are idempotent; votes survive reload and undo', async (t) => {
  const { fetch, file, allowed } = await fixture(t);
  const saved = storage();
  const first = createLikesClient('/api/likes', { fetch, storage: saved, randomUUID });
  const second = createLikesClient('/api/likes', { fetch, storage: storage(), randomUUID });
  assert.deepEqual((await first.list(['alpha'])).get('alpha'), { count: 0, liked: false });
  await Promise.all([first.set('alpha', true), first.set('alpha', true), second.set('alpha', true)]);
  assert.deepEqual((await second.list(['alpha'])).get('alpha'), { count: 2, liked: true });
  const restartedStore = createLocalLikesStore(file, allowed);
  const restartedClient = createLikesClient('/api/likes', {
    fetch: async (_url, options) => ({ ok: true, json: () => restartedStore(options.body) }), storage: saved, randomUUID,
  });
  assert.deepEqual((await restartedClient.list(['alpha'])).get('alpha'), { count: 2, liked: true });
  await restartedClient.set('alpha', false);
  await restartedClient.set('alpha', false);
  assert.deepEqual((await restartedClient.list(['alpha'])).get('alpha'), { count: 1, liked: false });
  await second.set('alpha', false);
  assert.equal((await first.list(['alpha'])).get('alpha').count, 0);
  assert.equal((await first.list(['beta'])).get('beta').count, 0);
});

test('unknown projects and malformed votes never alter stored totals', async (t) => {
  const { store } = await fixture(t);
  const voterId = randomUUID();
  for (const body of [
    params('set', { projectId: 'unknown', liked: 'true', voterId }),
    params('set', { projectId: 'alpha', liked: '10000', voterId }),
    params('set', { projectId: 'alpha', liked: 'true', voterId: 'anything' }),
    params('set', { projectId: '<script>', liked: 'true', voterId }),
    params('list', { projectIds: '["alpha","alpha"]' }),
    params('list', { projectIds: '{}' }),
  ]) await assert.rejects(store(body));
  const result = await store(params('list', { projectIds: '["alpha"]' }));
  assert.equal(result.projects[0].count, 0);
});

test('tabs opened before the first vote reuse the same browser identity', async (t) => {
  const { fetch } = await fixture(t);
  const saved = storage();
  const firstTab = createLikesClient('/api/likes', { fetch, storage: saved, randomUUID });
  const secondTab = createLikesClient('/api/likes', { fetch, storage: saved, randomUUID });
  await firstTab.list(['alpha']);
  await secondTab.list(['alpha']);
  await firstTab.set('alpha', true);
  assert.deepEqual((await secondTab.list(['alpha'])).get('alpha'), { count: 1, liked: true });
  await secondTab.set('alpha', true);
  assert.equal((await firstTab.list(['alpha'])).get('alpha').count, 1);
});

test('reading totals creates no browser identity, and stored votes contain no raw visitor tokens', async (t) => {
  const { fetch, file } = await fixture(t);
  const saved = storage();
  const id = randomUUID();
  const client = createLikesClient('/api/likes', { fetch, storage: saved, randomUUID: () => id });
  await client.list(['alpha']);
  assert.equal(saved.getItem('c4hu-voter-v1'), null);
  await client.set('alpha', true);
  assert.equal(saved.getItem('c4hu-voter-v1'), id);
  assert.equal((await readFile(file, 'utf8')).includes(id), false);
});

test('unavailable browser storage cannot silently create an unremembered vote', async (t) => {
  const { fetch } = await fixture(t);
  const client = createLikesClient('/api/likes', { fetch, storage: { getItem() { throw new Error('blocked'); } }, randomUUID });
  assert.equal((await client.list(['alpha'])).get('alpha').count, 0);
  assert.throws(() => client.set('alpha', true), /helyi tárolását/);
});

test('the client rejects fake success, missing counts, negative totals and non-JSON responses', async () => {
  for (const data of [{ ok: false, error: 'Nem sikerült.' }, { ok: true, projects: [] },
    { ok: true, projects: [{ id: 'alpha', count: -1, liked: false }] },
    { ok: true, projects: [{ id: 'alpha', count: 1, liked: 'false' }] }]) {
    const client = createLikesClient('/api/likes', { fetch: async () => ({ ok: true, json: async () => data }) });
    await assert.rejects(client.list(['alpha']));
  }
  const html = createLikesClient('/api/likes', { fetch: async () => ({ ok: true, json() { throw new SyntaxError('HTML'); } }) });
  await assert.rejects(html.list(['alpha']), /nem érhető el/);
});

test('both popularity orders use all records and break ties by Hungarian name', () => {
  const projects = [{ id: 'a', name: 'Átlátszó' }, { id: 'b', name: 'Béta' }, { id: 'c', name: 'Cé' }];
  const votes = new Map([['a', { count: 2 }], ['b', { count: 5 }], ['c', { count: 2 }]]);
  assert.deepEqual([...projects].sort((a, b) => compareLikes(a, b, votes)).map((p) => p.id), ['b', 'a', 'c']);
  assert.deepEqual([...projects].sort((a, b) => compareLikes(a, b, votes, 'asc')).map((p) => p.id), ['a', 'c', 'b']);
});
