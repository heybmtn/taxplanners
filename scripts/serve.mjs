// Minimal static server for the built site that mimics Workers static assets:
// trailing-slash redirects, 404.html, and headers from _headers. Used by the Lighthouse check.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.woff2': 'font/woff2' };

function parseHeaders(dir) {
  const f = join(dir, '_headers');
  if (!existsSync(f)) return [];
  const rules = []; let cur;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) { cur = { re: new RegExp(`^${line.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`), h: {} }; rules.push(cur); }
    else { const i = line.indexOf(':'); cur.h[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  }
  return rules;
}

export function serve(dir, port = 0) {
  const rules = parseHeaders(dir);
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    const p = decodeURIComponent(url.pathname);
    let file = join(dir, p);
    if (!p.endsWith('/') && !extname(p) && existsSync(join(file, 'index.html'))) { res.writeHead(307, { Location: `${p}/${url.search}` }); return res.end(); }
    if (p.endsWith('/')) file = join(file, 'index.html');
    let status = 200;
    if (!existsSync(file) || statSync(file).isDirectory()) { file = join(dir, '404.html'); status = 404; }
    const headers = { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' };
    for (const r of rules) if (r.re.test(p)) Object.assign(headers, r.h);
    // HSTS/upgrade-insecure-requests do not apply to http://localhost.
    if (headers['Content-Security-Policy']) headers['Content-Security-Policy'] = headers['Content-Security-Policy'].replace('; upgrade-insecure-requests', '');
    res.writeHead(status, headers);
    res.end(readFileSync(file));
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = await serve(process.argv[2] ?? 'dist', Number(process.argv[3] ?? 4321));
  console.log(`serving on http://127.0.0.1:${s.address().port}/`);
}
