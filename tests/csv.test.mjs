import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, parseProjectsCsv } from '../dist/csv.js';

const baseHeaders = ['Név', 'Weboldal', 'Cél', 'Fejlesztők', 'Kapcsolatok'];
const baseRow = ['Nyílt Város', 'https://example.org/', 'Átlátható közügyek', 'Közösség', 'hello@example.org'];
const cell = (value) => /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
const csv = (headers, rows) => [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
const sheet = (extraHeaders = [], extraValues = [], row = baseRow) => csv([...baseHeaders, ...extraHeaders], [[...row, ...extraValues]]);

test('empty CSV, BOM and blank lines are an intentional empty collection', () => {
  for (const value of ['', '\uFEFF', '\r\n\n', '\uFEFF \r\n\t']) {
    assert.deepEqual(parseCsv(value), []);
    assert.deepEqual(parseProjectsCsv(value), { projects: [], warnings: [] });
  }
});

test('quoted commas, escaped quotes, CRLF, embedded newlines and trailing empty cells', () => {
  assert.deepEqual(parseCsv('\uFEFFone,two,three\r\n"a,b","A ""quote""\r\nnext",\r\n'), [
    ['one', 'two', 'three'], ['a,b', 'A "quote"\r\nnext', ''],
  ]);
});

test('malformed quotation has a clear Hungarian error', () => {
  for (const value of ['a,b\n"unfinished,b', 'a"b,c', '"a"surprise,b']) {
    assert.throws(() => parseCsv(value), /CSV hiba.*sorban/);
  }
});

test('HTML exports, oversized data and incomplete schemas are rejected', () => {
  assert.throws(() => parseProjectsCsv('<!DOCTYPE html><html>Belépés</html>'), /HTML/);
  assert.throws(() => parseCsv('é'.repeat(1024 * 1024 + 1)), /2 MB/);
  assert.throws(() => parseProjectsCsv('Név,Weboldal\nA,https://example.org'), /hiányzó kötelező oszlopok/);
  assert.throws(() => parseProjectsCsv(csv([...baseHeaders, 'name'], [[...baseRow, 'másik']])), /ismétlődő oszlopnév/);
  assert.throws(() => parseProjectsCsv(csv([...baseHeaders, ''], [[...baseRow, '']])), /üres oszlopnév/);
});

test('Hungarian and ASCII headers generate the full safe app shape', () => {
  const result = parseProjectsCsv(csv(['nev', 'url', 'description', 'makers', 'contacts', 'cimke_1'], [[...baseRow, 'Nyílt adatok']]));
  assert.equal(result.warnings.length, 0);
  const project = result.projects[0];
  assert.equal(project.id, 'nyilt-varos');
  assert.equal(project.domain, 'example.org');
  assert.deepEqual(project.tags, ['Nyílt adatok']);
  assert.deepEqual(project.categories, ['nyilt-adatok']);
  assert.equal(project.contact, 'mailto:hello@example.org');
  assert.equal(project.image, './assets/screenshot-placeholder.svg');
  assert.deepEqual(project.sources, [{ label: 'Adatforrás', url: 'https://example.org/' }]);
  assert.equal(project.makers[0].role, 'Fejlesztő / projektgazda');
});

test('multiple makers accept parallel contacts or one common contact', () => {
  const row = [...baseRow]; row[3] = 'Ada | Béla'; row[4] = 'ada@example.org | https://example.org/bela';
  const { projects } = parseProjectsCsv(sheet([], [], row));
  assert.equal(projects[0].team, 'Ada · Béla');
  assert.deepEqual(projects[0].makers.map((maker) => maker.contact), ['mailto:ada@example.org', 'https://example.org/bela']);
  row[4] = 'mailto:hello@example.org';
  assert.deepEqual(parseProjectsCsv(sheet([], [], row)).projects[0].makers.map((maker) => maker.contact), ['mailto:hello@example.org', 'mailto:hello@example.org']);
  row[4] = 'one@example.org | two@example.org | three@example.org';
  assert.throws(() => parseProjectsCsv(sheet([], [], row)), /minden fejlesztőhöz/);
});

test('partial invalid rows are skipped and warnings use physical CSV line numbers', () => {
  const good = [...baseRow]; good[2] = 'Első sor\nMásodik sor';
  const bad = [...baseRow]; bad[0] = ''; bad[1] = 'javascript:alert(1)';
  const result = parseProjectsCsv(csv(baseHeaders, [good, bad]));
  assert.equal(result.projects.length, 1);
  assert.match(result.warnings[0], /CSV 4\. sor kihagyva/);
});

test('all invalid active records fail instead of becoming a misleading empty catalog', () => {
  const bad = [...baseRow]; bad[1] = 'javascript:alert(1)';
  assert.throws(() => parseProjectsCsv(csv(baseHeaders, [bad])), /egyetlen érvényes aktív/);
  assert.deepEqual(parseProjectsCsv(baseHeaders.join(',')), { projects: [], warnings: [] });
});

test('inactive rows skip value validation and can yield an intentionally empty result', () => {
  assert.deepEqual(parseProjectsCsv(sheet(['Aktív'], ['nem'], ['', 'javascript:bad', '', '', ''])), { projects: [], warnings: [] });
  assert.equal(parseProjectsCsv(sheet(['active'], [''])).projects.length, 1);
  assert.equal(parseProjectsCsv(sheet(['active'], ['true'])).projects.length, 1);
});

test('dangerous site and contact URLs never reach project records', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'https://user:secret@example.org/', 'https://example.org/\nfoo', 'https://example.org/%0afoo']) {
    const row = [...baseRow]; row[1] = url;
    assert.throws(() => parseProjectsCsv(sheet([], [], row)), /sor kihagyva/);
  }
  for (const contact of ['javascript:alert(1)', 'data:text/plain,test', 'mailto:x@example.org?bcc=other@example.org', 'x@example.org%0aBcc:other@example.org']) {
    const row = [...baseRow]; row[4] = contact;
    assert.throws(() => parseProjectsCsv(sheet([], [], row)), /Kapcsolatok/);
  }
});

test('images allow safe local assets or HTTPS URLs and reject escapes', () => {
  assert.equal(parseProjectsCsv(sheet(['Képernyőkép'], ['assets/shots/demo.png'])).projects[0].image, './assets/shots/demo.png');
  assert.equal(parseProjectsCsv(sheet(['image'], ['https://example.org/shot.png?width=800'])).projects[0].image, 'https://example.org/shot.png?width=800');
  for (const image of ['../secret', './assets/../secret', './assets/%2e%2e/secret', '//example.org/image.png', 'http://example.org/a.png', 'assets/a.svg?x=javascript:bad', 'data:image/svg+xml,bad']) {
    assert.throws(() => parseProjectsCsv(sheet(['image'], [image])), /Képernyőkép/);
  }
});

test('public GitHub repository alone never implies open source', () => {
  const result = parseProjectsCsv(sheet(['GitHub repository'], ['https://github.com/team/project.git/']));
  assert.equal(result.projects[0].githubUrl, 'https://github.com/team/project');
  assert.equal(result.projects[0].openSource, 'unknown');
  assert.equal(parseProjectsCsv(sheet(['github_url', 'open_source'], ['https://github.com/team/project', 'nem'])).projects[0].openSource, 'no');
});

test('explicit open-source status needs a valid GitHub repository and otherwise degrades with warning', () => {
  const good = parseProjectsCsv(sheet(['Nyílt forráskód', 'github_url', 'Licenc'], ['igen', 'https://github.com/team/project', 'MIT']));
  assert.equal(good.projects[0].openSource, 'yes');
  assert.equal(good.projects[0].license, 'MIT');
  for (const repository of ['', 'https://evil.example/team/project', 'https://github.com/team/project/tree/main', 'javascript:alert(1)', 'https://user:secret@github.com/team/project']) {
    const result = parseProjectsCsv(sheet(['open_source', 'github_url'], ['true', repository]));
    assert.equal(result.projects.length, 1);
    assert.equal(result.projects[0].openSource, 'unknown');
    assert.equal(result.projects[0].githubUrl, '');
    assert.match(result.warnings[0], /státusza „nem ismert”/);
  }
});

test('dates validate actual calendar days including leap years', () => {
  const result = parseProjectsCsv(sheet(['Ellenőrizve', 'Kép dátuma'], ['2024-02-29', '2026-10-12']));
  assert.equal(result.projects[0].verifiedAt, '2024-02-29');
  assert.equal(result.projects[0].screenshotDate, '2026-10-12');
  for (const value of ['2023-02-29', '2026-04-31', '2026-13-01', '2026-1-1', '0000-01-01']) {
    assert.throws(() => parseProjectsCsv(sheet(['verified_at'], [value])), /valós dátum/);
  }
});

test('duplicate identifiers and unsafe explicit IDs are rejected per row', () => {
  const result = parseProjectsCsv(csv(baseHeaders, [baseRow, baseRow]));
  assert.equal(result.projects.length, 1);
  assert.match(result.warnings[0], /ismétlődő azonosító/);
  assert.throws(() => parseProjectsCsv(sheet(['Azonosító'], ['bad id\"><script>'])), /Azonosító/);
});

test('human and canonical categories map consistently; unknown topics are reported', () => {
  const result = parseProjectsCsv(sheet(['Témakörök'], ['Átláthatóság | kozpenzek | Nyílt adatok | Állampolgári részvétel | Önkormányzatok']));
  assert.deepEqual(result.projects[0].categories, ['atlathatosag', 'kozpenzek', 'nyilt-adatok', 'reszvetel', 'onkormanyzatok']);
  assert.throws(() => parseProjectsCsv(sheet(['categories'], ['something-else'])), /ismeretlen témakör/);
});
