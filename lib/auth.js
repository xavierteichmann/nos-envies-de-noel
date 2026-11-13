// Liens personnels.
// Chaque personne a une clé du type "alice-Xy12...". La partie après le prénom est une
// signature calculée à partir d'un secret (CLE_FAMILLE) connu du serveur seul :
// impossible de deviner la clé de quelqu'un d'autre sans ce secret.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getPeople } from './people.js';

function secret() {
  const s = process.env.CLE_FAMILLE;
  if (s) return s;
  if (process.env.VERCEL) {
    throw Object.assign(new Error("La variable CLE_FAMILLE n'est pas définie sur Vercel."), { status: 500 });
  }
  return 'secret-de-test-local';
}

export function keyFor(id) {
  const sig = createHmac('sha256', secret()).update(id).digest('base64url').slice(0, 16);
  return `${id}-${sig}`;
}

// Renvoie la personne correspondant à la clé, ou null.
export function personFromKey(key) {
  if (typeof key !== 'string' || key.length > 80) return null;
  for (const p of getPeople()) {
    const expected = Buffer.from(keyFor(p.id));
    const given = Buffer.from(key);
    if (expected.length === given.length && timingSafeEqual(expected, given)) return p;
  }
  return null;
}
