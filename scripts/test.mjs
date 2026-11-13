// Vérifie les règles importantes, surtout le secret.  npm test
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.ENVIES_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'envies-'));
process.env.FAMILLE = 'Alice, Bernard,Chloé,David,Emma';
delete process.env.DATABASE_URL; delete process.env.POSTGRES_URL;

const { buildState, act } = await import('../lib/core.js');
const { byId } = await import('../lib/people.js');
const { keyFor, personFromKey } = await import('../lib/auth.js');
const [chloe, david, alice, emma] = ['chloe', 'david', 'alice', 'emma'].map(byId);
const list = async (viewer, owner) => (await buildState(viewer)).lists[owner.id];

// Liens personnels
assert.equal(personFromKey(keyFor('chloe')).id, 'chloe');
assert.equal(personFromKey('chloe-nimportequoi12345'), null);
assert.equal(personFromKey(undefined), null);

// Chloé ajoute deux idées
await act(chloe, { type: 'add', title: '  Écharpe   en laine ', detail: 'bleu marine' });
await act(chloe, { type: 'add', title: 'Livre de cuisine' });
assert.equal((await act(chloe, { type: 'add', title: '   ' })).message.includes('idée'), true);
let l = await list(david, chloe);
assert.deepEqual(l.map((i) => i.title), ['Écharpe en laine', 'Livre de cuisine']);
const [echarpe, livre] = l.map((i) => i.id);

// David offre l'écharpe en secret, Alice le livre avec son prénom
assert.deepEqual(await act(david, { type: 'reserve', id: echarpe, anon: true }), {});
assert.deepEqual(await act(alice, { type: 'reserve', id: livre, anon: false }), {});

// LE SECRET : Chloé ne reçoit rien d'autre que ses idées
const chloeState = await buildState(chloe);
for (const it of chloeState.lists.chloe) assert.deepEqual(Object.keys(it).sort(), ['detail', 'id', 'title']);
assert.equal(chloeState.notices.length, 0);
assert.equal(/status|taken|mine|anon|"by"/.test(JSON.stringify(chloeState.lists.chloe)), false);

// Les autres voient "pris", avec ou sans prénom selon le choix
l = await list(emma, chloe);
assert.deepEqual(l.map((i) => [i.status, i.by]), [['taken', null], ['taken', 'Alice']]);
assert.equal(JSON.stringify(l).includes('David'), false);
l = await list(david, chloe);
assert.deepEqual(l.map((i) => i.status), ['mine', 'taken']);

// Pas de double réservation, pas de réservation sur sa propre liste
assert.match((await act(emma, { type: 'reserve', id: echarpe })).message, /juste avant toi/);
assert.match((await act(chloe, { type: 'reserve', id: echarpe })).message, /propre liste/);
assert.equal((await list(david, chloe))[0].status, 'mine');

// On ne peut ni annuler la réservation d'un autre, ni retirer l'idée d'un autre
await act(emma, { type: 'cancel', id: echarpe });
await act(emma, { type: 'remove', id: echarpe });
assert.equal((await list(emma, chloe))[0].status, 'taken');

// Alice change d'avis : le livre redevient libre
await act(alice, { type: 'cancel', id: livre });
assert.equal((await list(emma, chloe))[1].status, 'free');

// Chloé retire l'écharpe (réservée par David) : David est prévenu, lui seul
await act(chloe, { type: 'remove', id: echarpe });
assert.equal((await list(emma, chloe)).length, 1);
assert.equal((await buildState(chloe)).lists.chloe.length, 1);
assert.equal((await buildState(emma)).notices.length, 0);
const n = (await buildState(david)).notices;
assert.deepEqual(n, [{ id: echarpe, title: 'Écharpe en laine', ownerName: 'Chloé' }]);
await act(emma, { type: 'dismiss', id: echarpe });
assert.equal((await buildState(david)).notices.length, 1);
await act(david, { type: 'dismiss', id: echarpe });
assert.equal((await buildState(david)).notices.length, 0);

// Chloé retire une idée non réservée : elle disparaît simplement
await act(chloe, { type: 'remove', id: livre });
assert.equal((await list(david, chloe)).length, 0);

console.log('Tout est bon : le secret est tenu et les cas limites passent.');
