import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const host = '127.0.0.1';
const args = process.argv.slice(2);
let port = 4173;

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  if (arg === '--port') port = Number(args[++index]);
  else if (arg.startsWith('--port=')) port = Number(arg.slice(7));
  else {
    console.error(`Ismeretlen opció: ${arg}. Használat: npm start -- --port 4173`);
    process.exit(1);
  }
}

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('A portnak 1 és 65535 közötti egész számnak kell lennie.');
  process.exit(1);
}

const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), '../dist'));
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.pdf': 'application/pdf',
};

function isWithinRoot(path) {
  const localPath = relative(root, path);
  return localPath !== '..' && !localPath.startsWith(`..${sep}`) && !isAbsolute(localPath);
}

function respond(request, response, status, message) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(request.method === 'HEAD' ? undefined : message);
}

const server = createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Cache-Control', 'no-store');

  if (!['GET', 'HEAD'].includes(request.method)) {
    response.setHeader('Allow', 'GET, HEAD');
    respond(request, response, 405, 'Ez a kiszolgáló csak GET és HEAD kéréseket fogad.');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, `http://${host}:${port}`).pathname);
  } catch {
    respond(request, response, 400, 'Hibás URL.');
    return;
  }

  if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').includes('..')) {
    respond(request, response, 403, 'Ez az útvonal nem érhető el.');
    return;
  }

  try {
    let filePath = resolve(root, `.${pathname}`);
    if (!isWithinRoot(filePath)) {
      respond(request, response, 403, 'Ez az útvonal nem érhető el.');
      return;
    }

    let info = await stat(filePath);
    if (info.isDirectory()) {
      filePath = resolve(filePath, 'index.html');
      info = await stat(filePath);
    }
    filePath = await realpath(filePath);
    if (!isWithinRoot(filePath) || !info.isFile()) {
      respond(request, response, 403, 'Ez az útvonal nem érhető el.');
      return;
    }

    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Content-Length': info.size,
    });
    if (request.method === 'HEAD') response.end();
    else {
      const stream = createReadStream(filePath);
      stream.on('error', () => response.destroy());
      response.on('close', () => stream.destroy());
      stream.pipe(response);
    }
  } catch (error) {
    const missing = ['ENOENT', 'ENOTDIR'].includes(error.code);
    respond(request, response, missing ? 404 : 500, missing ? 'Az oldal nem található.' : 'A fájl nem olvasható.');
  }
});

server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE'
    ? `A ${port} port már foglalt. Másik port: npm start -- --port 4174`
    : `A szerver nem indítható: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`Code for Hungary · helyi előnézet: http://${host}:${port}/`);
  console.log('Leállítás: Ctrl+C');
});
