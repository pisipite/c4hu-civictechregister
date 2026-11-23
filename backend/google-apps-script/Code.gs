// Másold be egy saját, új Google Apps Script projektbe, majd futtasd a setup függvényt.
// A katalógust csak olvassuk. A tetszéseknek a setup külön táblázatot hoz létre.
const CATALOG_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTu0zyHCCrXFWwK2CEhAbR7YgfmDZZ4wL099wPk34obxC2dvAf2VxBbDSl3yXHeGg7sg2NM4ComjHBA/pub?output=csv';
const VOTES_SHEET = 'Tetszések';
const PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/i;
const VOTER_ID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

function setup() {
  const properties = PropertiesService.getScriptProperties();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    let spreadsheetId = properties.getProperty('VOTES_SPREADSHEET_ID');
    if (!spreadsheetId) {
      const spreadsheet = SpreadsheetApp.create('Code for Hungary – tetszések (privát)');
      const sheet = spreadsheet.getSheets()[0].setName(VOTES_SHEET);
      sheet.appendRow(['project_id', 'voter_hash', 'created_at']);
      sheet.setFrozenRows(1);
      spreadsheetId = spreadsheet.getId();
      properties.setProperties({ VOTES_SPREADSHEET_ID: spreadsheetId, VOTER_SALT: Utilities.getUuid() });
      SpreadsheetApp.flush();
    }
    console.log('Szavazattáblázat: https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/edit');
    console.log('Ezt a táblázatot ne publikáld; a webalkalmazás csak összesített számokat ad vissza.');
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json_({ ok: true, service: 'Code for Hungary – tetszések', version: 1 });
}

function doPost(event) {
  try {
    if (!event || !event.parameter || (event.postData && event.postData.length > 65536)) fail_('Hibás vagy túl nagy kérés.');
    const input = event.parameter;
    const voterId = input.voterId || '';
    if (voterId && !VOTER_ID_PATTERN.test(voterId)) fail_('Érvénytelen böngészőazonosító.');
    let ids;
    if (input.action === 'list') {
      try { ids = JSON.parse(input.projectIds); } catch (_) { fail_('Hibás projektlista.'); }
      if (!Array.isArray(ids) || ids.length > 500 || ids.some(id => typeof id !== 'string' || !PROJECT_ID_PATTERN.test(id)) || new Set(ids).size !== ids.length) fail_('Hibás projektlista.');
    } else if (input.action === 'set') {
      if (!voterId || typeof input.projectId !== 'string' || !PROJECT_ID_PATTERN.test(input.projectId) || !['true', 'false'].includes(input.liked)) fail_('Érvénytelen szavazat.');
      ids = [input.projectId];
      if (!activeProjectIds_().includes(input.projectId)) fail_('Ez a projekt már nem található az aktív gyűjteményben.');
    } else fail_('Ismeretlen művelet.');

    const properties = PropertiesService.getScriptProperties();
    const spreadsheetId = properties.getProperty('VOTES_SPREADSHEET_ID');
    const salt = properties.getProperty('VOTER_SALT');
    if (!spreadsheetId || !salt) fail_('A szavazás még nincs beállítva.');
    const voterHash = voterId ? Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + voterId, Utilities.Charset.UTF_8)
      .map(byte => (byte & 255).toString(16).padStart(2, '0')).join('') : '';

    // A zárolás a lekérést is védi: senki nem olvas félkész módosítást.
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(8000)) fail_('A szavazás most foglalt. Próbáld újra néhány másodperc múlva.');
    try {
      const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(VOTES_SHEET);
      if (!sheet) fail_('A szavazattáblázat nem érhető el.');
      const lastRow = sheet.getLastRow();
      const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 3).getValues() : [];
      if (input.action === 'set') {
        const index = rows.findIndex(row => row[0] === input.projectId && row[1] === voterHash);
        const liked = input.liked === 'true';
        if ((index >= 0) !== liked) {
          checkRate_(voterHash);
          if (liked) {
            const row = [input.projectId, voterHash, new Date().toISOString()];
            sheet.appendRow(row);
            rows.push(row);
          } else {
            sheet.deleteRow(index + 2);
            rows.splice(index, 1);
          }
          SpreadsheetApp.flush();
        }
      }
      return json_({ ok: true, projects: ids.map(id => {
        const matching = rows.filter(row => row[0] === id);
        return { id: id, count: matching.length, liked: Boolean(voterHash) && matching.some(row => row[1] === voterHash) };
      }) });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    if (!error.publicMessage) console.error('Szavazási hiba: ' + error.message);
    return json_({ ok: false, error: error.publicMessage || 'A szavazási szolgáltatás most nem érhető el. Próbáld újra később.' });
  }
}

function activeProjectIds_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('catalog-project-ids-v1');
  if (cached) return JSON.parse(cached);
  const response = UrlFetchApp.fetch(CATALOG_CSV_URL, { followRedirects: true, muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) fail_('A projektlista ellenőrzése most nem sikerült. Próbáld újra később.');
  const text = response.getContentText('UTF-8').replace(/^\uFEFF/, '');
  if (text.length > 2 * 1024 * 1024 || /^\s*</.test(text)) fail_('A projektlista most nem olvasható.');
  const records = Utilities.parseCsv(text);
  if (!records.length) return [];
  const headers = records[0].map(normalize_);
  const column = names => headers.findIndex(header => names.includes(header));
  const idColumn = column(['azonosito', 'id']);
  const nameColumn = column(['nev', 'name']);
  const activeColumn = column(['aktiv', 'active']);
  if (nameColumn < 0) fail_('A projektlista fejlécét ellenőrizni kell.');
  const ids = [];
  for (const row of records.slice(1)) {
    const active = normalize_(row[activeColumn] || '');
    if (!['', 'igen', 'true', '1', 'yes', 'nem_ismert', 'unknown', 'ismeretlen'].includes(active)) continue;
    if (!(row[nameColumn] || '').trim()) continue;
    const id = (row[idColumn] || '').trim() || normalize_(row[nameColumn]).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
    if (PROJECT_ID_PATTERN.test(id)) ids.push(id);
  }
  const unique = Array.from(new Set(ids));
  cache.put('catalog-project-ids-v1', JSON.stringify(unique), 60);
  return unique;
}

function checkRate_(voterHash) {
  const cache = CacheService.getScriptCache();
  const key = 'vote-rate-' + voterHash + '-' + Math.floor(Date.now() / 60000);
  const count = Number(cache.get(key) || 0);
  if (count >= 30) fail_('Túl sok módosítás rövid idő alatt. Próbáld újra egy perc múlva.');
  cache.put(key, String(count + 1), 120);
}

function normalize_(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[\s-]+/g, '_');
}

function fail_(message) {
  const error = new Error(message);
  error.publicMessage = message;
  throw error;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
