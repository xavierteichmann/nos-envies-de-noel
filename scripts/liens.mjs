// Affiche le lien personnel de chacun.
// Usage :  npm run liens -- https://ton-adresse.vercel.app
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

if (!process.env.CLE_FAMILLE) {
  console.error('CLE_FAMILLE est introuvable (fichier .env.local). Les liens ne correspondraient pas au site en ligne.');
  process.exit(1);
}
const base = (process.argv[2] || 'http://localhost:3000').replace(/\/+$/, '');
const { keyFor } = await import('../lib/auth.js');
const { getPeople } = await import('../lib/people.js');
for (const p of getPeople()) console.log(`${p.name.padEnd(10)} ${base}/?k=${keyFor(p.id)}`);
