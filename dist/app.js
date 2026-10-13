import { config } from './config.js';
import { parseProjectsCsv } from './csv.js';

(() => {
  'use strict';
  const PAGE_SIZE = 12;
  let visibleLimit = PAGE_SIZE;
  let projects = [];
  let searchable = new Map();
  let loadState = 'loading';
  let sourceMode = 'live';
  let activeRequest;
  let loadError = '';
  const $ = (selector) => document.querySelector(selector);
  const grid = $('#project-grid');
  const loadMore = $('#load-more');
  const search = $('#search');
  const sort = $('#sort');
  const dialog = $('#project-dialog');
  const filterButtons = [...document.querySelectorAll('[data-filter]')];
  const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('hu').trim();
  const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const external = 'target="_blank" rel="noopener noreferrer"';
  const linkAttrs = (url) => url.startsWith('mailto:') ? '' : external;
  let category = 'all';

  const mailBody = [
    'Sziasztok!', '', 'Az alábbi kezdeményezést ajánlom a civic-tech gyűjteménybe:', '',
    'Projekt neve: ', 'Weboldal címe: ', 'Milyen közügyi célt szolgál? ',
    '1–2 tematikus címke: ', 'Fejlesztő(k) / projektgazda neve: ',
    'Nyilvános elérhetőségük: ', 'Képernyőkép linkje (vagy csatolmány): ',
    'Nyílt forráskódú? (igen / nem / nem ismert): ', 'GitHub repository: ', 'Licenc: ', '',
    'Köszönöm!'
  ].join('\n');
  const submissionUrl = `mailto:${config.submissionEmail}?subject=${encodeURIComponent('Új kezdeményezés a civic-tech gyűjteménybe')}&body=${encodeURIComponent(mailBody)}`;
  document.querySelectorAll('[data-submit]').forEach((a) => { a.href = submissionUrl; });
  document.querySelectorAll('[data-contact]').forEach((a) => {
    a.href = `mailto:${config.submissionEmail}`;
    if (a.textContent.includes('@')) a.textContent = config.submissionEmail;
  });
  $('#year').textContent = new Date().getFullYear();
  $('#data-source-link').href = config.csvUrl;

  function sourceCode(p, detailed = false) {
    const label = p.openSource === 'yes' ? 'Nyílt forráskód' : p.openSource === 'no' ? 'Nem nyílt forráskódú' : 'Forráskód: nem ismert';
    return `<div class="source-code-row ${p.openSource === 'yes' ? 'is-open' : ''}"><span>${icon('code')}${label}</span>${p.githubUrl ? `<a href="${escape(p.githubUrl)}" ${external} aria-label="${escape(p.name)} — GitHub repository">GitHub ${icon('external')}</a>` : ''}</div>${detailed && p.license ? `<p class="license-note">A hivatkozott repository licence: <strong>${escape(p.license)}</strong></p>` : ''}`;
  }

  function dateLabel(value) {
    if (!value) return 'nincs megadva';
    return new Intl.DateTimeFormat('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
  }

  function card(p, index) {
    return `<article class="project-card" aria-labelledby="title-${escape(p.id)}" style="--card-tint:${escape(p.tint)}">
      <a class="project-visual" href="${escape(p.url)}" ${external} aria-label="${escape(p.name)} weboldalának megnyitása (új lapon)">
        <div class="browser-frame"><div class="browser-bar" aria-hidden="true"><i></i><i></i><i></i><span>${escape(p.domain)}</span></div><img src="${escape(p.image)}" alt="${escape(p.imageAlt)}" width="1280" height="720" loading="${index < 3 ? 'eager' : 'lazy'}" decoding="async"></div><span class="visual-open">${icon('external')}</span>
      </a>
      <div class="project-body"><div class="project-tags">${p.tags.map((t) => `<span class="tag">${escape(t)}</span>`).join('')}</div>
        <h3 class="project-title" id="title-${escape(p.id)}"><a href="${escape(p.url)}" ${external}>${escape(p.name)}</a></h3>
        <p class="project-description">${escape(p.description)}</p>
        ${p.note ? `<p class="card-note"><span>↳</span> ${escape(p.note)}</p>` : ''}
        ${sourceCode(p)}
        <div class="project-team"><span class="team-label">KÉSZÍTŐK ÉS FENNTARTÓK</span><div class="team-line"><span class="team-mark" aria-hidden="true">${escape(p.mark)}</span><span class="team-name">${escape(p.team)}</span><a class="contact-link" href="${escape(p.contact)}" ${linkAttrs(p.contact)} aria-label="${escape(p.name)} — kapcsolat" title="${escape(p.contact.replace('mailto:', ''))}">${icon('mail')}</a></div></div>
        <p class="project-verified"><span>Ellenőrizve:</span> ${p.verifiedAt ? `<time datetime="${escape(p.verifiedAt)}">${escape(dateLabel(p.verifiedAt))}</time>` : '<span>nincs megadva</span>'}</p>
      </div>
      <div class="card-actions"><a href="${escape(p.url)}" ${external}>Weboldal ${icon('external')}</a><button class="details-button" data-details="${escape(p.id)}" aria-label="${escape(p.name)} — részletek">Részletek ${icon('arrow')}</button></div>
    </article>`;
  }

  function updateUrl() {
    const url = new URL(window.location.href);
    for (const [key, value] of [['q', search.value.trim()], ['tema', category === 'all' ? '' : category], ['sorrend', sort.value === 'curated' ? '' : sort.value]]) {
      if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
    }
    history.replaceState(null, '', url);
  }

  function render(syncUrl = true, append = false) {
    if (!append) visibleLimit = PAGE_SIZE;
    const words = normalize(search.value).split(/\s+/).filter(Boolean);
    const matches = projects.filter((p) => (category === 'all' || p.categories.includes(category)) && words.every((word) => searchable.get(p.id).includes(word)));
    if (sort.value !== 'curated') matches.sort((a, b) => a.name.localeCompare(b.name, 'hu') * (sort.value === 'za' ? -1 : 1));
    const visible = matches.slice(0, visibleLimit);
    if (append) {
      const start = grid.children.length;
      grid.insertAdjacentHTML('beforeend', visible.slice(start).map((p, index) => card(p, start + index)).join(''));
    } else {
      grid.innerHTML = visible.map(card).join('');
    }
    $('#load-more-control').hidden = visible.length >= matches.length;
    $('#load-more-count').textContent = `${visible.length} / ${matches.length} kezdeményezés megjelenítve`;
    grid.hidden = visible.length === 0;
    $('#empty-state').hidden = visible.length !== 0 || loadState === 'loading';
    grid.setAttribute('aria-busy', String(loadState === 'loading'));
    const noDatabase = loadState === 'empty' || loadState === 'error';
    $('#empty-title').textContent = loadState === 'error' ? 'Az adatforrás most nem tölthető be.' : loadState === 'empty' ? 'A táblázatban még nincs megjeleníthető kezdeményezés.' : 'Erre még nincs találat.';
    $('#empty-description').textContent = loadState === 'error' ? `${loadError} Próbáld újra a Frissítés gombbal, vagy nézd meg a mintaadatokat.` : loadState === 'empty' ? 'Töltsd le a mintaexcelt, majd másold a Kezdeményezések lap adatait a publikált Google Sheets-munkalapra. Ezután frissítsd a gyűjteményt.' : 'Próbálj másik kifejezést, vagy nézd meg az összes kezdeményezést.';
    $('#reset-filters').hidden = noDatabase;
    $('#show-sample').hidden = !noDatabase || sourceMode === 'sample';
    $('#empty-download').hidden = !noDatabase;
    $('#clear-search').hidden = !search.value;
    $('#total-count').textContent = loadState === 'loading' ? '–' : projects.length;
    $('[data-filter="all"] span').textContent = loadState === 'loading' ? '–' : projects.length;
    $('#results-count').textContent = loadState === 'loading' ? 'Betöltés folyamatban…' : words.length || category !== 'all' ? `${matches.length} találat · ${visible.length} megjelenítve · ${projects.length} kezdeményezésből` : `${visible.length} / ${projects.length} kezdeményezés megjelenítve`;
    search.disabled = sort.disabled = !projects.length;
    filterButtons.forEach((button) => {
      button.disabled = !projects.length;
      const active = button.dataset.filter === category;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (syncUrl) updateUrl();
  }

  async function loadCatalog(mode = 'live') {
    if (activeRequest) activeRequest.abort();
    const request = new AbortController();
    activeRequest = request;
    const timeout = setTimeout(() => request.abort(), config.requestTimeoutMs);
    sourceMode = mode;
    loadState = 'loading';
    projects = [];
    searchable.clear();
    $('#reload-data').disabled = true;
    $('#data-warnings').hidden = true;
    $('#data-status').dataset.state = 'loading';
    $('#data-message').textContent = mode === 'sample' ? 'Mintaadatok betöltése…' : 'A gyűjtemény betöltése a Google Sheetsből…';
    render(false);
    try {
      let response;
      try {
        response = await fetch(mode === 'sample' ? config.sampleCsvUrl : config.csvUrl, { signal: request.signal, cache: 'no-store', credentials: 'omit' });
      } catch (error) {
        if (error.name === 'AbortError') throw new Error('A letöltés túllépte a várakozási időt.');
        throw new Error('A letöltés nem sikerült. Ellenőrizd az internetkapcsolatot és a táblázat publikálását.');
      }
      if (!response.ok) throw new Error(`Az adatforrás HTTP ${response.status} hibát jelzett.`);
      const csvText = await response.text();
      const result = parseProjectsCsv(csvText);
      if (activeRequest !== request) return;
      projects = result.projects;
      searchable = new Map(projects.map((p) => [p.id, normalize([
        p.name, p.domain, p.description, p.team, p.license, p.openSource === 'yes' ? 'nyílt forráskód' : '', ...p.tags, ...p.makers.map((m) => m.name)
      ].join(' '))]));
      loadState = projects.length ? 'ready' : 'empty';
      $('#data-status').dataset.state = mode === 'sample' ? 'sample' : loadState;
      $('#data-message').textContent = mode === 'sample' ? 'Mintaadatok előnézete · Ezek az Excel-mintából származnak, nem a Google Sheetsből.' : projects.length ? 'A gyűjtemény a Google Sheets-adatforrásból betöltve.' : 'A Google Sheets-adatforrás elérhető, de még nincs benne megjeleníthető adat.';
      if (result.warnings.length) {
        $('#data-warnings').hidden = false;
        $('#warnings-summary').textContent = `${result.warnings.length} javítandó adat a táblázatban`;
        $('#warnings-list').innerHTML = result.warnings.map((message) => `<li>${escape(message)}</li>`).join('');
      }
    } catch (error) {
      if (activeRequest !== request) return;
      projects = [];
      loadState = 'error';
      loadError = error.name === 'AbortError' ? 'A letöltés túllépte a várakozási időt.' : error.message;
      $('#data-status').dataset.state = 'error';
      $('#data-message').textContent = mode === 'sample' ? 'A mintaadatok betöltése nem sikerült.' : 'A Google Sheets-adatforrás betöltése nem sikerült.';
    } finally {
      clearTimeout(timeout);
      if (activeRequest === request) {
        $('#reload-data').disabled = false;
        $('#reload-data').textContent = mode === 'sample' ? 'Vissza a Google Sheets-adatokhoz' : 'Frissítés';
        render(false);
      }
    }
  }

  function readUrl() {
    const params = new URLSearchParams(window.location.search);
    search.value = params.get('q') || '';
    category = filterButtons.some((b) => b.dataset.filter === params.get('tema')) ? params.get('tema') : 'all';
    sort.value = ['az', 'za'].includes(params.get('sorrend')) ? params.get('sorrend') : 'curated';
    render(false);
  }

  filterButtons.forEach((button) => button.addEventListener('click', () => { category = button.dataset.filter; render(); }));
  search.addEventListener('input', () => render());
  sort.addEventListener('change', () => render());
  loadMore.addEventListener('click', () => {
    const previousCount = grid.children.length;
    visibleLimit += PAGE_SIZE;
    render(false, true);
    grid.children[previousCount]?.querySelector('.project-title a')?.focus({ preventScroll: true });
  });
  $('#clear-search').addEventListener('click', () => { search.value = ''; render(); search.focus(); });
  $('#reset-filters').addEventListener('click', () => { search.value = ''; category = 'all'; sort.value = 'curated'; render(); search.focus(); });
  $('#reload-data').addEventListener('click', () => loadCatalog('live'));
  $('#show-sample').addEventListener('click', () => { search.value = ''; category = 'all'; sort.value = 'curated'; updateUrl(); loadCatalog('sample'); });
  window.addEventListener('popstate', readUrl);
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !dialog.open && !event.target.closest('input, textarea, select, [contenteditable]')) {
      event.preventDefault(); search.focus();
    }
  });

  grid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-details]');
    if (!button) return;
    const p = projects.find((project) => project.id === button.dataset.details);
    if (!p) return;
    $('#dialog-content').innerHTML = `<img class="dialog-image" src="${escape(p.image)}" alt="${escape(p.imageAlt)}" width="1280" height="720">
      <div class="dialog-body"><div class="project-tags">${p.tags.map((t) => `<span class="tag">${escape(t)}</span>`).join('')}</div><h2 id="dialog-title">${escape(p.name)}</h2><p>${escape(p.description)}</p>
      ${p.detail ? `<p>${escape(p.detail)}</p>` : ''}${p.note ? `<p><strong>Megjegyzés:</strong> ${escape(p.note)}</p>` : ''}
      <h3>Forráskód</h3>${sourceCode(p, true)}
      <h3>Készítők, fejlesztők és kapcsolatok</h3><ul class="maker-list">${p.makers.map((m) => `<li><div><strong>${escape(m.name)}</strong><span>${escape(m.role)}</span></div><a href="${escape(m.contact)}" ${linkAttrs(m.contact)}>${escape(m.contactLabel)}</a></li>`).join('')}</ul>
      <h3>Források</h3><ul class="source-list">${p.sources.map((s) => `<li><a href="${escape(s.url)}" ${external}>${escape(s.label)}</a></li>`).join('')}</ul>
      <p class="dialog-footnote">Adatok ellenőrizve: ${escape(dateLabel(p.verifiedAt))}<br>Képernyőkép dátuma: ${escape(dateLabel(p.screenshotDate))}<br>A megjelenés azóta változhatott. A képen szereplő márkák és tartalmak a jogosultjaikhoz tartoznak.</p>
      <a class="button button-dark dialog-visit" href="${escape(p.url)}" ${external}>Megnyitom a weboldalt ${icon('external')}</a></div>`;
    dialog.showModal();
    document.body.classList.add('dialog-open');
  });
  $('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  document.addEventListener('error', (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.matches('.project-visual img, .dialog-image') || image.dataset.fallback) return;
    image.dataset.fallback = 'true';
    image.src = './assets/screenshot-placeholder.svg';
    image.alt = 'A projekt képernyőképe jelenleg nem érhető el.';
  }, true);
  readUrl();
  loadCatalog();
})();
