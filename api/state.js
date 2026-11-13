// GET /api/state : renvoie tout ce que la personne connectée a le droit de voir.
import { personFromKey } from '../lib/auth.js';
import { buildState } from '../lib/core.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const me = personFromKey(req.headers['x-cle']);
    if (!me) return res.status(401).json({ message: 'Lien inconnu.' });
    return res.status(200).json(await buildState(me));
  } catch (e) {
    console.error(e);
    return res.status(e.status || 500).json({ message: e.status ? e.message : 'Un problème est survenu.' });
  }
}
