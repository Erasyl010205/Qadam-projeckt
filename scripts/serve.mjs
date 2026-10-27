import http from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const port = Number(process.env.QADAM_PORT ?? 4173);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error('QADAM_PORT must be a number from 0 to 65535.');
  process.exit(1);
}
if (!existsSync(resolve(root, 'index.html'))) {
  console.error('dist/index.html табылмады. ZIP архивін толық шығарып, START-QADAM.cmd файлын қайта ашыңыз.');
  process.exit(1);
}
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': `${types[extname(file)] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-cache' }).end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }).end(
      '<!doctype html><html lang="kk"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Qadam Code</title><body style="background:#080d1a;color:#f8fafc;font:18px/1.8 system-ui;padding:40px"><h1>Бұл мекенжай табылмады</h1><p>Сайтты төмендегі сілтемемен ашыңыз.</p><a style="color:#80acff" href="/#dashboard">Qadam Code сайтын ашу →</a></body></html>'
    );
  }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? '4173 порты бос емес. START-QADAM.cmd файлын ашыңыз: ол бос портты автоматты түрде таңдайды.'
    : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  console.log('Qadam Code дайын. Терезені ашық қалдырыңыз.');
  console.log('Local: ' + url);
  if (process.argv.includes('--open') && process.platform === 'win32') {
    const browser = spawn('cmd.exe', ['/c', 'start', '', url], { windowsHide:true, stdio:'ignore' });
    browser.on('error', () => console.log('Браузерден мына мекенжайды ашыңыз: ' + url));
    browser.unref();
  }
});
