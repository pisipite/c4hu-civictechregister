import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const ID = /^[a-z0-9][a-z0-9_-]{0,79}$/i;
const VOTER = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export function createLocalLikesStore(file, allowedProjectIds) {
  let queue = Promise.resolve();

  async function apply(parameters) {
    const action = parameters.get('action');
    const voterId = parameters.get('voterId') || '';
    if (voterId && !VOTER.test(voterId)) throw new Error('Érvénytelen böngészőazonosító.');
    let ids;
    if (action === 'list') {
      try { ids = JSON.parse(parameters.get('projectIds')); } catch { throw new Error('Hibás projektlista.'); }
      if (!Array.isArray(ids) || ids.length > 500 || ids.some((id) => typeof id !== 'string' || !ID.test(id)) || new Set(ids).size !== ids.length) throw new Error('Hibás projektlista.');
    } else if (action === 'set') {
      ids = [parameters.get('projectId')];
      if (!voterId || typeof ids[0] !== 'string' || !ID.test(ids[0]) || !['true', 'false'].includes(parameters.get('liked'))) throw new Error('Érvénytelen szavazat.');
      if (!(await allowedProjectIds()).has(ids[0])) throw new Error('Ez a projekt már nem található az aktív gyűjteményben.');
    } else throw new Error('Ismeretlen művelet.');

    let rows;
    try { rows = JSON.parse(await readFile(file, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; rows = []; }
    if (!Array.isArray(rows)) throw new Error('A helyi szavazatfájl nem olvasható.');
    const hash = voterId ? createHash('sha256').update(voterId).digest('hex') : '';
    if (action === 'set') {
      const index = rows.findIndex((row) => row.projectId === ids[0] && row.voterHash === hash);
      const liked = parameters.get('liked') === 'true';
      if ((index >= 0) !== liked) {
        if (liked) rows.push({ projectId: ids[0], voterHash: hash });
        else rows.splice(index, 1);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(`${file}.tmp`, JSON.stringify(rows), 'utf8');
        await rename(`${file}.tmp`, file);
      }
    }
    return { ok: true, projects: ids.map((id) => {
      const matching = rows.filter((row) => row.projectId === id);
      return { id, count: matching.length, liked: matching.some((row) => row.voterHash === hash) };
    }) };
  }

  // Serialize reads and writes so concurrent local requests cannot lose a vote.
  return (parameters) => {
    const result = queue.then(() => apply(parameters));
    queue = result.catch(() => {});
    return result;
  };
}
