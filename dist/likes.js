const STORAGE_KEY = 'c4hu-voter-v1';
const VOTER_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export function likesEndpoint(configured, location) {
  if (configured) {
    const url = new URL(configured);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Érvénytelen szavazási szolgáltatás.');
    return url.href;
  }
  return ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname) ? './api/likes' : '';
}

export function compareLikes(a, b, votes, direction = 'desc') {
  const difference = (votes.get(a.id)?.count ?? 0) - (votes.get(b.id)?.count ?? 0);
  return difference * (direction === 'asc' ? 1 : -1) || a.name.localeCompare(b.name, 'hu');
}

export function createLikesClient(endpoint, { fetch: request = globalThis.fetch, storage, randomUUID = () => globalThis.crypto.randomUUID(), timeoutMs = 20000 } = {}) {
  let voterId = '';
  function syncVoter() {
    try {
      const saved = storage?.getItem(STORAGE_KEY);
      if (VOTER_PATTERN.test(saved || '')) voterId = saved;
    } catch { /* Reading totals does not require browser storage. */ }
    return voterId;
  }

  function voter() {
    if (syncVoter()) return voterId;
    try {
      const id = randomUUID();
      storage.setItem(STORAGE_KEY, id);
      if (storage.getItem(STORAGE_KEY) !== id) throw new Error();
      voterId = id;
      return id;
    } catch {
      throw new Error('A tetszés megjegyzéséhez engedélyezd a böngésző helyi tárolását.');
    }
  }

  async function send(parameters, ids) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      // Form POST avoids a preflight; no cookies or account credentials are sent.
      const response = await request(endpoint, {
        method: 'POST', body: new URLSearchParams(parameters), credentials: 'omit',
        redirect: 'follow', signal: controller.signal,
      });
      if (!response.ok) throw new Error('A tetszések szolgáltatása most nem érhető el.');
      const data = await response.json();
      if (data.ok !== true) throw new Error(data.error || 'A művelet nem sikerült.');
      if (!Array.isArray(data.projects)) throw new Error('Hiányos válasz érkezett a szavazási szolgáltatástól.');
      const values = new Map();
      for (const item of data.projects) {
        if (!ids.includes(item.id) || values.has(item.id) || !Number.isSafeInteger(item.count) || item.count < 0 || typeof item.liked !== 'boolean') {
          throw new Error('Hibás szavazatszám érkezett.');
        }
        values.set(item.id, { count: item.count, liked: item.liked });
      }
      if (values.size !== ids.length) throw new Error('Hiányos szavazatszámok érkeztek.');
      return values;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('A szavazási szolgáltatás túl lassan válaszolt. Próbáld újra.');
      if (error instanceof SyntaxError || error instanceof TypeError) throw new Error('A szavazási szolgáltatás nem érhető el. Próbáld újra.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    list: (ids) => send({ action: 'list', projectIds: JSON.stringify(ids), voterId: syncVoter() }, ids),
    set: (id, liked) => send({ action: 'set', projectId: id, liked: String(liked), voterId: voter() }, [id]),
  };
}
