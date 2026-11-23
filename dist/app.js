import { config } from './config.js';
import { parseProjectsCsv } from './csv.js';
import { createLikesClient, likesEndpoint, compareLikes } from './likes.js';

(() => {
  'use strict';
  const PAGE_SIZE = 12;
  const DEFAULT_SORT = 'date-desc';
  let visibleLimit = PAGE_SIZE;
  let projects = [];
  let searchable = new Map();
  let loadState = 'loading';
  let sourceMode = 'live';
  let activeRequest;
  let loadError = '';
  let votes = new Map();
  let likesState = 'loading';
  let likesRevision = 0;
  let likesError = '';
  const pendingLikes = new Set();
  let endpoint = '';
  let browserStorage;
  try { endpoint = likesEndpoint(config.likesApiUrl, window.location); } catch { /* Show unavailable state. */ }
  try { browserStorage = window.localStorage; } catch { /* Counts can still be read. */ }
  const likes = createLikesClient(endpoint, { storage: browserStorage });
  const $ = (selector) => document.querySelector(selector);
  const grid = $('#project-grid');
  const loadMore = $('#load-more');
  const search = $('#search');
  const sort = $('#sort');
  const openSourceFilter = $('#filter-open-source');
  const dialog = $('#project-dialog');
  const filterButtons = [...document.querySelectorAll('[data-filter]')];
  const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('hu').trim();
  const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const topics = new Map(filterButtons.filter((button) => button.dataset.filter !== 'all')
    .map((button) => [button.dataset.filter, button.textContent.trim()]));
  const tagIcons = new Map([
    ...[...topics].map(([id, label]) => [normalize(label), `topic-${id}`]),
    ['kormanyzati tisztsegviselok', 'topic-onkormanyzatok'], ['szemelyi valtozasok', 'topic-reszvetel'],
    ['kozossegi media', 'message'], ['politikai kommunikacio', 'message'], ['digitalis archivalas', 'archive'],
    ['kulturalis tamogatasok', 'topic-kozpenzek'], ['kozertheto jogszabalyok', 'scales'], ['igeretkovetes', 'checklist'],
    ['tulajdonosi halok', 'network'], ['turizmus', 'pin'], ['adatigenyles', 'document'], ['adatfigyeles', 'search'],
    ['kozigazgatas', 'topic-onkormanyzatok'], ['parlament', 'topic-onkormanyzatok'], ['kozterulet', 'pin'],
    ['eljaraskovetes', 'scales'], ['korrupciofigyeles', 'topic-atlathatosag'], ['mobilalkalmazas', 'phone'],
    ['mediaelemzes', 'news'], ['mediatudatossag', 'news'], ['balaton', 'waves'], ['kornyezetvedelem', 'leaf'],
    ['napenergia', 'sun'], ['energiatudatossag', 'sun'], ['energia', 'energy'],
    ['egeszsegugyi alapellatas', 'health'], ['orvoshiany', 'health'],
  ]);
  const external = 'target="_blank" rel="noopener noreferrer"';
  const linkAttrs = (url) => url.startsWith('mailto:') ? '' : external;
  let category = 'all';
  let openSourceOnly = false;

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
    return `<article class="project-card" aria-labelledby="title-${escape(p.id)}">
      <div class="project-preview">
      <a class="project-visual" href="${escape(p.url)}" ${external} aria-label="${escape(p.name)} weboldalának megnyitása (új lapon)">
        <div class="browser-frame"><div class="browser-bar" aria-hidden="true"><i></i><i></i><i></i><span>${escape(p.domain)}</span></div><img src="${escape(p.image)}" alt="${escape(p.imageAlt)}" width="1280" height="720" loading="${index < 3 ? 'eager' : 'lazy'}" decoding="async"></div><span class="visual-open">${icon('external')}</span>
      </a>
      ${topicBadges(p)}
      </div>
      <div class="project-body">${tagBadges(p)}
        <h3 class="project-title" id="title-${escape(p.id)}"><a href="${escape(p.url)}" ${external}>${escape(p.name)}</a></h3>
        <p class="project-description">${escape(p.description)}</p>
        ${p.note ? `<p class="card-note"><span>↳</span> ${escape(p.note)}</p>` : ''}
        ${sourceCode(p)}
        <div class="project-team"><span class="team-label">KÉSZÍTŐK ÉS FENNTARTÓK</span><div class="team-line"><span class="team-mark" aria-hidden="true">${escape(p.mark)}</span><span class="team-name">${escape(p.team)}</span><a class="contact-link" href="${escape(p.contact)}" ${linkAttrs(p.contact)} aria-label="${escape(p.name)} — kapcsolat" title="${escape(p.contact.replace('mailto:', ''))}">${icon('mail')}</a></div></div>
        <p class="project-verified"><span>Ellenőrizve:</span> ${p.verifiedAt ? `<time datetime="${escape(p.verifiedAt)}">${escape(dateLabel(p.verifiedAt))}</time>` : '<span>nincs megadva</span>'}</p>
      </div>
      <div class="card-actions"><a href="${escape(p.url)}" ${external}>Weboldal ${icon('external')}</a>${likeButton(p)}<button class="details-button" data-details="${escape(p.id)}" aria-label="${escape(p.name)} — részletek">Részletek ${icon('arrow')}</button></div>
    </article>`;
  }

  function topicBadges(p, showLabels = false) {
    const assigned = [...topics].filter(([id]) => p.categories.includes(id));
    if (!assigned.length) return '';
    return `<ul class="project-topics${showLabels ? ' topic-labels' : ''}" aria-label="Témakörök">${assigned.map(([id, label]) =>
      `<li class="topic-badge" title="${escape(label)}">${icon(`topic-${id}`)}<span${showLabels ? '' : ' class="sr-only"'}>${escape(label)}</span></li>`).join('')}</ul>`;
  }

  function tagBadges(p) {
    return `<div class="project-tags">${p.tags.map((tag) => `<span class="tag">${icon(tagIcons.get(normalize(tag)) || 'tag')}${escape(tag)}</span>`).join('')}</div>`;
  }

  function likeButton(p) {
    if (sourceMode === 'sample') return '';
    const vote = votes.get(p.id);
    const pending = pendingLikes.has(p.id);
    const enabled = likesState === 'ready' && vote && !pending;
    const action = pending ? 'Tetszés mentése…' : vote?.liked ? 'Tetszés visszavonása' : 'Tetszik';
    const title = likesState === 'loading' ? 'Tetszések betöltése…' : likesState !== 'ready' ? 'A tetszések jelenleg nem érhetők el.' : `${action} · ${vote.count.toLocaleString('hu')} tetszés`;
    return `<button class="like-button" type="button" data-like="${escape(p.id)}" aria-pressed="${Boolean(vote?.liked)}" aria-busy="${pending}" aria-label="${escape(p.name)} — ${escape(title)}" title="${escape(title)}" ${enabled ? '' : 'disabled'}>${icon('like')}<span>${vote ? vote.count.toLocaleString('hu') : '–'}</span></button>`;
  }

  function updateLikesNotice() {
    const local = endpoint === './api/likes';
    $('#likes-notice').hidden = sourceMode === 'sample' || !projects.length;
    $('#likes-message').textContent = likesError || (likesState === 'loading' ? 'Tetszések betöltése…' : likesState === 'ready' ? local ? 'Helyi próba: ezek a tetszések nem kerülnek az éles oldalra.' : 'Böngészőnként egy tetszés adható projektenként; újabb kattintással visszavonható.' : 'A tetszések jelenleg nem érhetők el.');
    $('#retry-likes').hidden = !endpoint || !likesError;
    for (const option of sort.querySelectorAll('option[value^="likes-"]')) option.disabled = likesState !== 'ready' || sourceMode === 'sample';
  }

  async function loadLikes() {
    const revision = ++likesRevision;
    votes = new Map();
    likesError = '';
    likesState = endpoint && sourceMode !== 'sample' ? 'loading' : 'disabled';
    render(false, false, false);
    if (likesState === 'disabled' || !projects.length) return;
    try {
      const result = await likes.list(projects.map((p) => p.id));
      if (revision !== likesRevision) return;
      votes = result;
      likesState = 'ready';
    } catch (error) {
      if (revision !== likesRevision) return;
      likesState = 'error';
      likesError = error.message;
    }
    render(false, false, false);
  }

  async function toggleLike(id) {
    if (likesState !== 'ready' || pendingLikes.has(id) || !votes.has(id) || sourceMode !== 'live') return;
    const revision = likesRevision;
    const desired = !votes.get(id).liked;
    pendingLikes.add(id);
    likesError = '';
    const refreshButton = () => {
      const button = [...grid.querySelectorAll('[data-like]')].find((element) => element.dataset.like === id);
      const project = projects.find((p) => p.id === id);
      if (button && project) button.outerHTML = likeButton(project);
    };
    refreshButton();
    try {
      const result = await likes.set(id, desired);
      if (revision !== likesRevision) return;
      votes.set(id, result.get(id));
      likesError = '';
    } catch (error) {
      if (revision !== likesRevision) return;
      // The server might have saved a timed-out request. Read its authoritative state.
      let confirmedSaved = false;
      try {
        const confirmed = await likes.list([id]);
        if (revision !== likesRevision) return;
        votes.set(id, confirmed.get(id));
        confirmedSaved = confirmed.get(id).liked === desired;
      } catch { /* Keep the last confirmed number, never invent a successful vote. */ }
      likesError = confirmedSaved ? '' : error.message;
    } finally {
      pendingLikes.delete(id);
      if (revision === likesRevision) {
        const shouldRestoreFocus = !document.activeElement || document.activeElement === document.body || document.activeElement.dataset.like === id;
        if (sort.value.startsWith('likes-')) render(false, false, false);
        else { refreshButton(); updateLikesNotice(); }
        if (shouldRestoreFocus) [...grid.querySelectorAll('[data-like]')].find((button) => button.dataset.like === id)?.focus({ preventScroll: true });
      }
    }
  }

  function updateUrl() {
    const url = new URL(window.location.href);
    const filters = [
      ['q', search.value.trim()],
      ['tema', category === 'all' ? '' : category],
      ['nyilt-forraskod', openSourceOnly ? '1' : ''],
      ['sorrend', sort.value === DEFAULT_SORT ? '' : sort.value],
    ];
    for (const [key, value] of filters) {
      if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
    }
    history.replaceState(null, '', url);
  }

  function render(syncUrl = true, append = false, resetLimit = true) {
    if (!append && resetLimit) visibleLimit = PAGE_SIZE;
    if (sort.value.startsWith('likes-') && ['disabled', 'error'].includes(likesState)) {
      sort.value = DEFAULT_SORT;
      updateUrl();
    }
    const words = normalize(search.value).split(/\s+/).filter(Boolean);
    const matches = projects.filter((project) =>
      (category === 'all' || project.categories.includes(category)) &&
      (!openSourceOnly || project.openSource === 'yes') &&
      words.every((word) => searchable.get(project.id).includes(word))
    );
    if (sort.value.startsWith('likes-')) {
      if (likesState === 'ready') matches.sort((a, b) => compareLikes(a, b, votes, sort.value === 'likes-asc' ? 'asc' : 'desc'));
    } else if (sort.value === 'date-asc' || sort.value === 'date-desc') {
      const direction = sort.value === 'date-asc' ? 1 : -1;
      matches.sort((a, b) => {
        // Missing dates stay last in both directions; validated ISO dates sort lexically.
        if (!a.verifiedAt) return b.verifiedAt ? 1 : 0;
        if (!b.verifiedAt) return -1;
        return a.verifiedAt.localeCompare(b.verifiedAt) * direction;
      });
    } else if (sort.value !== 'curated') {
      matches.sort((a, b) => a.name.localeCompare(b.name, 'hu') * (sort.value === 'za' ? -1 : 1));
    }
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
    $('#empty-description').textContent = loadState === 'error' ? `${loadError} Próbáld újra az alábbi Adatbázis részletei doboz Frissítés gombjával, vagy nézd meg a mintaadatokat.` : loadState === 'empty' ? 'Töltsd le a mintaexcelt, majd másold a Kezdeményezések lap adatait a publikált Google Sheets-munkalapra. Ezután frissítsd a gyűjteményt.' : 'Próbálj másik kifejezést, vagy nézd meg az összes kezdeményezést.';
    $('#reset-filters').hidden = noDatabase;
    $('#show-sample').hidden = !noDatabase || sourceMode === 'sample';
    $('#empty-download').hidden = !noDatabase;
    $('#clear-search').hidden = !search.value;
    $('#total-count').textContent = loadState === 'loading' ? '–' : projects.length;
    const latestVerifiedAt = projects.reduce((latest, project) => project.verifiedAt > latest ? project.verifiedAt : latest, '');
    $('#database-updated').hidden = loadState === 'loading' || loadState === 'error';
    $('#database-updated').innerHTML = `${sourceMode === 'sample' ? 'Mintaadatok ellenőrizve' : 'Legutóbbi adatellenőrzés'}: ${latestVerifiedAt ? `<time datetime="${escape(latestVerifiedAt)}">${escape(dateLabel(latestVerifiedAt))}</time>` : 'nincs megadva'}`;
    $('[data-filter="all"] span').textContent = loadState === 'loading' ? '–' : projects.length;
    const filtered = words.length > 0 || category !== 'all' || openSourceOnly;
    $('#results-count').textContent = loadState === 'loading' ? 'Betöltés folyamatban…' : filtered ? `${matches.length} találat · ${visible.length} megjelenítve · ${projects.length} kezdeményezésből` : `${visible.length} / ${projects.length} kezdeményezés megjelenítve`;
    search.disabled = sort.disabled = !projects.length;
    openSourceFilter.disabled = !projects.length;
    openSourceFilter.classList.toggle('active', openSourceOnly);
    openSourceFilter.setAttribute('aria-pressed', String(openSourceOnly));
    filterButtons.forEach((button) => {
      button.disabled = !projects.length;
      const active = button.dataset.filter === category;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    updateLikesNotice();
    if (syncUrl) updateUrl();
  }

  async function loadCatalog(mode = 'live') {
    if (activeRequest) activeRequest.abort();
    const request = new AbortController();
    activeRequest = request;
    const timeout = setTimeout(() => request.abort(), config.requestTimeoutMs);
    sourceMode = mode;
    loadState = 'loading';
    likesRevision += 1;
    votes = new Map();
    likesState = 'loading';
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
        if (loadState === 'ready') loadLikes();
      }
    }
  }

  function readUrl() {
    const params = new URLSearchParams(window.location.search);
    const requestedSort = params.get('sorrend');
    search.value = params.get('q') || '';
    category = filterButtons.some((b) => b.dataset.filter === params.get('tema')) ? params.get('tema') : 'all';
    openSourceOnly = params.get('nyilt-forraskod') === '1';
    sort.value = [...sort.options].some((option) => option.value === requestedSort) ? requestedSort : DEFAULT_SORT;
    render(false);
  }

  function resetCatalogControls() {
    search.value = '';
    category = 'all';
    openSourceOnly = false;
    sort.value = DEFAULT_SORT;
  }

  filterButtons.forEach((button) => button.addEventListener('click', () => { category = button.dataset.filter; render(); }));
  openSourceFilter.addEventListener('click', () => { openSourceOnly = !openSourceOnly; render(); });
  search.addEventListener('input', () => render());
  sort.addEventListener('change', () => render());
  loadMore.addEventListener('click', () => {
    const previousCount = grid.children.length;
    visibleLimit += PAGE_SIZE;
    render(false, true);
    grid.children[previousCount]?.querySelector('.project-title a')?.focus({ preventScroll: true });
  });
  $('#clear-search').addEventListener('click', () => { search.value = ''; render(); search.focus(); });
  $('#reset-filters').addEventListener('click', () => { resetCatalogControls(); render(); search.focus(); });
  $('#reload-data').addEventListener('click', () => loadCatalog('live'));
  $('#retry-likes').addEventListener('click', () => loadLikes());
  $('#show-sample').addEventListener('click', () => { resetCatalogControls(); updateUrl(); loadCatalog('sample'); });
  window.addEventListener('popstate', readUrl);
  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !dialog.open && !event.target.closest('input, textarea, select, [contenteditable]')) {
      event.preventDefault(); search.focus();
    }
  });

  grid.addEventListener('click', (event) => {
    const like = event.target.closest('[data-like]');
    if (like) { toggleLike(like.dataset.like); return; }
    const button = event.target.closest('[data-details]');
    if (!button) return;
    const p = projects.find((project) => project.id === button.dataset.details);
    if (!p) return;
    $('#dialog-content').innerHTML = `<img class="dialog-image" src="${escape(p.image)}" alt="${escape(p.imageAlt)}" width="1280" height="720">
      <div class="dialog-body">${topicBadges(p, true)}${tagBadges(p)}<h2 id="dialog-title">${escape(p.name)}</h2><p>${escape(p.description)}</p>
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
