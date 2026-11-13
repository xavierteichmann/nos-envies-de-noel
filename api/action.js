// POST /api/action : ajouter, retirer, offrir, ne plus offrir.
// Répond toujours avec l'état à jour, pour que l'écran se rafraîchisse en un seul aller-retour.
import { personFromKey } from '../lib/auth.js';
import { act, buildState } from '../lib/core.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Méthode non autorisée.' });
    const me = personFromKey(req.headers['x-cle']);
    if (!me) return res.status(401).json({ message: 'Lien inconnu.' });
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { message } = await act(me, body);
    return res.status(200).json({ message: message || null, state: await buildState(me) });
  } catch (e) {
    console.error(e);
    return res.status(e.status || 500).json({ message: e.status ? e.message : 'Un problème est survenu.' });
  }
}
