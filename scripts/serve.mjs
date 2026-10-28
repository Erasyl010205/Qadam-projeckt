import http from 'node:http';
import { existsSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { spawn } from 'node:child_process';
import { handlePongRequest } from '../server/pong-api.js';
import { openLocalD1 } from '../server/sqlite-d1.js';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(project, 'public');
const port = Number(process.env.QADAM_PORT ?? 4173);
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('QADAM_PORT must be an integer from 0 to 65535.');
if (!existsSync(resolve(root, 'index.html'))) throw new Error('public/index.html табылмады. Архивті толық шығарыңыз.');
const storage = resolve(project, '.qadam-data');
mkdirSync(storage, { recursive: true });
const db = openLocalD1(resolve(storage, 'pong.sqlite'), { migrationsDir: resolve(project, 'drizzle') });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://' + (req.headers.host || '127.0.0.1'));
    if (url.pathname.startsWith('/api/pong/')) {
      const request = new Request(url, {
        method: req.method, headers: req.headers,
        ...(!['GET', 'HEAD'].includes(req.method) ? { body: Readable.toWeb(req), duplex: 'half' } : {})
      });
      const response = await handlePongRequest(request, db);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    const pathname = decodeURIComponent(url.pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': (types[extname(file)] || 'application/octet-stream') + '; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }).end('<!doctype html><html lang="kk"><meta charset="UTF-8"><title>Qadam Code</title><h1>Бұл мекенжай табылмады</h1><a href="/#dashboard">Qadam Code сайтын ашу →</a></html>');
  }
});
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'Порт бос емес. START-QADAM.cmd бос портты таңдайды.' : error.message); process.exitCode = 1; db.close(); });
server.listen(port, '127.0.0.1', () => {
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  console.log('Qadam Code және пинг-понг сервері дайын. Терезені ашық қалдырыңыз.');
  console.log('Local: ' + url);
  if (process.argv.includes('--open') && process.platform === 'win32') {
    const browser = spawn('cmd.exe', ['/c', 'start', '', url], { windowsHide: true, stdio: 'ignore' });
    browser.on('error', () => console.log('Браузерден ашыңыз: ' + url));
    browser.unref();
  }
});
function close() { server.close(() => { db.close(); process.exit(0); }); }
process.once('SIGINT', close);
process.once('SIGTERM', close);
