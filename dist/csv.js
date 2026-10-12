const MAX_BYTES = 2 * 1024 * 1024;
const PALETTE = ['#edf2eb', '#f5eeeb', '#ebf1f5', '#f1eef7', '#f4efeb', '#eff1f7'];
const REQUIRED = ['name', 'url', 'description', 'makers', 'contacts'];
const LABELS = { name: 'Név', url: 'Weboldal', description: 'Cél', makers: 'Fejlesztők', contacts: 'Kapcsolatok' };
const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[\s-]+/g, '_');
const aliases = {
  id: ['id', 'azonosito'], name: ['name', 'nev'], url: ['url', 'weboldal'],
  description: ['description', 'cel'], tag1: ['tag1', 'cimke_1'], tag2: ['tag2', 'cimke_2'],
  categories: ['categories', 'temakorok'], image: ['image', 'kepernyokep'],
  makers: ['makers', 'fejlesztok'], contacts: ['contacts', 'kapcsolatok'],
  open_source: ['open_source', 'nyilt_forraskod'], github_url: ['github_url', 'github_repository'],
  license: ['license', 'licenc'], source_url: ['source_url', 'forras'],
  verified_at: ['verified_at', 'ellenorizve'], screenshot_date: ['screenshot_date', 'kep_datuma'],
  note: ['note', 'megjegyzes'], active: ['active', 'aktiv'],
};
const HEADERS = new Map(Object.entries(aliases).flatMap(([key, values]) => values.map((value) => [value, key])));
const CATEGORY_ALIASES = new Map([
  ['atlathatosag', 'atlathatosag'], ['kozpenzek', 'kozpenzek'], ['nyilt_adatok', 'nyilt-adatok'],
  ['reszvetel', 'reszvetel'], ['allampolgari_reszvetel', 'reszvetel'], ['onkormanyzatok', 'onkormanyzatok'],
]);

function csvError(line, message) {
  return new Error(`CSV hiba a(z) ${line}. sorban: ${message}`);
}

function parseRecords(text) {
  if (typeof text !== 'string') throw new Error('A CSV tartalmának szövegnek kell lennie.');
  if (text.length > MAX_BYTES || new TextEncoder().encode(text).length > MAX_BYTES) {
    throw new Error('A CSV túl nagy; legfeljebb 2 MB méretű fájl tölthető be.');
  }
  text = text.replace(/^\uFEFF/, '');
  if (!text.trim()) return [];
  if (/^\s*(?:<!doctype\s+html|<(?:html|head|body|table)\b)/i.test(text)) {
    throw new Error('CSV helyett HTML oldal érkezett. A közzétett CSV-export hivatkozását add meg.');
  }
  const records = [];
  let values = [], field = '', state = 'start', line = 1, startLine = 1;
  const finishField = () => { values.push(field); field = ''; state = 'start'; };
  const finishRecord = () => {
    finishField();
    if (values.some((value) => value.trim())) records.push({ values, line: startLine });
    values = [];
  };
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const newline = char === '\r' || char === '\n';
    if (state === 'quoted') {
      if (char === '"') {
        if (text[index + 1] === '"') { field += '"'; index += 1; }
        else state = 'closed';
      } else if (newline) {
        field += char;
        if (char === '\r' && text[index + 1] === '\n') { field += '\n'; index += 1; }
        line += 1;
      } else field += char;
      continue;
    }
    if (newline) {
      finishRecord();
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      line += 1;
      startLine = line;
    } else if (char === ',') finishField();
    else if (char === '"' && state === 'start') state = 'quoted';
    else if (char === '"') throw csvError(line, 'idézőjel csak a mező elején vagy párosítva szerepelhet.');
    else if (state === 'closed') throw csvError(line, 'a lezáró idézőjel után vessző vagy sortörés szükséges.');
    else { field += char; state = 'plain'; }
  }
  if (state === 'quoted') throw csvError(startLine, 'nincs lezárva az idézőjeles mező.');
  finishRecord();
  return records;
}

/** Parse comma-separated CSV into string arrays, keeping the header as the first row. */
export function parseCsv(text) {
  return parseRecords(text).map((record) => record.values);
}

function unsafeUrl(value) {
  return /[\u0000-\u001f\u007f-\u009f]/.test(value) || /%(?:0[0-9a-f]|1[0-9a-f]|7f|8[0-9a-f]|9[0-9a-f])/i.test(value);
}

function httpUrl(value, label, httpsOnly = false) {
  if (unsafeUrl(value) || value.includes('\\')) throw new Error(`${label}: nem biztonságos URL.`);
  let parsed;
  try { parsed = new URL(value.trim()); } catch { throw new Error(`${label}: érvénytelen URL.`); }
  if (!(httpsOnly ? ['https:'] : ['http:', 'https:']).includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error(`${label}: csak ${httpsOnly ? 'HTTPS' : 'HTTP(S)'} cím adható meg, felhasználónév és jelszó nélkül.`);
  }
  return parsed.href;
}

function contactUrl(value) {
  if (unsafeUrl(value)) throw new Error('Kapcsolatok: a cím vezérlőkaraktert tartalmaz.');
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return httpUrl(value, 'Kapcsolatok');
  const email = trimmed.replace(/^mailto:/i, '');
  if (!/^[^\s@<>(),;:"\\[\]?%#]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/i.test(email)) {
    throw new Error('Kapcsolatok: e-mail-cím, mailto: hivatkozás vagy HTTP(S) URL szükséges.');
  }
  return `mailto:${email}`;
}

function imageUrl(value) {
  if (!value.trim()) return './assets/screenshot-placeholder.svg';
  if (unsafeUrl(value)) throw new Error('Képernyőkép: nem biztonságos URL.');
  const trimmed = value.trim();
  if (/^https:\/\//i.test(trimmed)) return httpUrl(value, 'Képernyőkép', true);
  const local = trimmed.replace(/^\.\//, '');
  if (!local.startsWith('assets/') || /[\\:%?#]/.test(local) || local.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error('Képernyőkép: HTTPS URL vagy az assets/ könyvtáron belüli útvonal szükséges.');
  }
  return `./${local}`;
}

function githubUrl(value) {
  if (!value.trim()) return '';
  const parsed = new URL(httpUrl(value, 'GitHub repository', true));
  const path = parsed.pathname.replace(/\/$/, '').replace(/\.git$/, '');
  if (parsed.hostname !== 'github.com' || parsed.port || parsed.search || parsed.hash ||
    !/^\/[a-z0-9](?:[a-z0-9-]{0,38})\/[a-z0-9_.-]+$/i.test(path) || /\/\.{1,2}$/.test(path)) {
    throw new Error('GitHub repository: https://github.com/tulajdonos/repository alakú cím szükséges.');
  }
  return `https://github.com${path}`;
}

function status(value, label) {
  const token = normalize(value);
  if (['igen', 'true', '1', 'yes'].includes(token)) return 'yes';
  if (['nem', 'false', '0', 'no'].includes(token)) return 'no';
  if (['', 'nem_ismert', 'unknown', 'ismeretlen'].includes(token)) return 'unknown';
  throw new Error(`${label}: „igen”, „nem” vagy üres érték adható meg.`);
}

function date(value, label) {
  const text = value.trim();
  if (!text) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || text.startsWith('0000') ||
    !Number.isFinite(Date.parse(`${text}T12:00:00Z`)) || new Date(`${text}T12:00:00Z`).toISOString().slice(0, 10) !== text) {
    throw new Error(`${label}: valós dátum szükséges ÉÉÉÉ-HH-NN alakban.`);
  }
  return text;
}

function list(value, label) {
  if (!value.trim()) return [];
  const items = value.split('|').map((item) => item.trim());
  if (items.some((item) => !item)) throw new Error(`${label}: a | jelek között nem maradhat üres érték.`);
  return items;
}

function categoryList(value, tags) {
  if (!value.trim()) return [...new Set(tags.map((tag) => CATEGORY_ALIASES.get(normalize(tag))).filter(Boolean))];
  return [...new Set(list(value, 'Témakörök').map((item) => {
    const result = CATEGORY_ALIASES.get(normalize(item));
    if (!result) throw new Error(`Témakörök: ismeretlen témakör („${item}”).`);
    return result;
  }))];
}

/** Validate the sheet schema and return safe catalog records plus row-level warnings. */
export function parseProjectsCsv(text) {
  const records = parseRecords(text);
  if (!records.length) return { projects: [], warnings: [] };
  const [header, ...rows] = records;
  const usedHeaders = new Set();
  const headers = header.values.map((value) => {
    const key = normalize(value);
    if (!key) throw csvError(header.line, 'a fejlécben üres oszlopnév található.');
    const canonical = HEADERS.get(key) || key;
    if (usedHeaders.has(canonical)) throw csvError(header.line, `ismétlődő oszlopnév: „${value.trim()}”.`);
    usedHeaders.add(canonical);
    return canonical;
  });
  const missing = REQUIRED.filter((key) => !usedHeaders.has(key));
  if (missing.length) throw csvError(header.line, `hiányzó kötelező oszlopok: ${missing.map((key) => LABELS[key]).join(', ')}.`);

  const projects = [], warnings = [], ids = new Set();
  let nonInactiveRows = 0;
  for (const row of rows) {
    let counted = false;
    try {
      const entry = Object.fromEntries(headers.map((key, index) => [key, row.values[index] || '']));
      const value = (key) => entry[key] || '';
      if (status(value('active'), 'Aktív') === 'no') continue;
      nonInactiveRows += 1;
      counted = true;
      if (row.values.length !== headers.length) throw new Error('az oszlopok száma eltér a fejlécétől; a vesszőt tartalmazó mezőket tedd idézőjelbe.');
      const empty = REQUIRED.filter((key) => !value(key).trim());
      if (empty.length) throw new Error(`hiányzó kötelező értékek: ${empty.map((key) => LABELS[key]).join(', ')}.`);

      const name = value('name').trim();
      const id = value('id').trim() || normalize(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || `projekt-${row.line}`;
      if (!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(id)) throw new Error('Azonosító: legfeljebb 80 betű, szám, kötőjel vagy aláhúzás használható; az első karakter betű vagy szám legyen.');
      if (ids.has(id)) throw new Error(`ismétlődő azonosító: „${id}”.`);
      const url = httpUrl(value('url'), 'Weboldal');
      const names = list(value('makers'), 'Fejlesztők');
      const contacts = list(value('contacts'), 'Kapcsolatok').map(contactUrl);
      if (contacts.length !== 1 && contacts.length !== names.length) throw new Error('Kapcsolatok: egy közös cím vagy minden fejlesztőhöz egy-egy cím szükséges, | jellel elválasztva.');
      const makers = names.map((maker, index) => {
        const contact = contacts.length === 1 ? contacts[0] : contacts[index];
        return { name: maker, role: 'Fejlesztő / projektgazda', contact, contactLabel: contact.replace(/^mailto:/, '') };
      });
      const tags = [...new Set([value('tag1').trim(), value('tag2').trim()].filter(Boolean))];
      const sourceValues = list(value('source_url'), 'Forrás');
      const sources = (sourceValues.length ? sourceValues : [url]).map((source) => ({ label: 'Adatforrás', url: httpUrl(source, 'Forrás') }));
      let openSource = status(value('open_source'), 'Nyílt forráskód');
      let github = '';
      let repositoryWarning = '';
      try { github = githubUrl(value('github_url')); }
      catch (error) {
        if (openSource !== 'yes') throw error;
        repositoryWarning = error.message;
      }
      if (openSource === 'yes' && !github) {
        openSource = 'unknown';
        repositoryWarning = `${repositoryWarning ? `${repositoryWarning} ` : ''}A nyílt forráskód státusza „nem ismert” lett, mert nincs érvényes GitHub repository.`;
      }
      const project = {
        id, name, url, domain: new URL(url).hostname, description: value('description').trim(),
        tags, categories: categoryList(value('categories'), tags), image: imageUrl(value('image')),
        imageAlt: value('image').trim() ? `${name} — a projekt weboldalának képernyőképe.` : `${name} — képernyőkép még nem érhető el.`,
        tint: PALETTE[projects.length % PALETTE.length], team: names.join(' · '),
        mark: names[0].split(/[\s-]+/).slice(0, 3).map((part) => [...part][0]).join('').toLocaleUpperCase('hu'),
        contact: contacts[0], makers, sources, note: value('note').trim(), openSource, githubUrl: github,
        license: value('license').trim(), verifiedAt: date(value('verified_at'), 'Ellenőrizve'),
        screenshotDate: date(value('screenshot_date'), 'Kép dátuma'),
      };
      ids.add(id);
      projects.push(project);
      if (repositoryWarning) warnings.push(`CSV ${row.line}. sor: ${repositoryWarning}`);
    } catch (error) {
      if (!counted) nonInactiveRows += 1;
      warnings.push(`CSV ${row.line}. sor kihagyva: ${error.message}`);
    }
  }
  if (nonInactiveRows && !projects.length) throw new Error(`A CSV egyetlen érvényes aktív kezdeményezést sem tartalmaz. ${warnings.join(' ')}`);
  return { projects, warnings };
}
