// Petit serveur pour essayer l'application sur ton Mac :  npm run dev
// Il imite ce que fait Vercel en ligne : il sert les fichiers de public/ et les routes /api/.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

// Charge .env.local (CLE_FAMILLE, FAMILLE, DATABASE_URL éventuelle) s'il existe.
try {
  for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const { keyFor } = await import('./lib/auth.js');
const { getPeople } = await import('./lib/people.js');
const handlers = {
  '/api/state': (await import('./api/state.js')).default,
  '/api/action': (await import('./api/action.js')).default,
};
const types = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.js': 'text/javascript', '.css': 'text/css' };
const port = Number(process.env.PORT) || 3000;

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const handler = handlers[url.pathname];
  if (handler) {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (obj) => { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(obj)); };
    return handler(req, res);
  }
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const file = path.join(root, 'public', rel);
  if (!file.startsWith(path.join(root, 'public')) || !fs.existsSync(file)) { res.statusCode = 404; return res.end('Introuvable'); }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`\nListes de test : http://localhost:${port}\n`);
  for (const p of getPeople()) console.log(`  ${p.name.padEnd(10)} http://localhost:${port}/?k=${keyFor(p.id)}`);
  console.log('');
});
