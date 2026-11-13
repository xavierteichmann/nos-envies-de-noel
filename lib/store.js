// Stockage des idées de cadeaux.
// En ligne : base Postgres (variable DATABASE_URL fournie par Vercel).
// Sur ton Mac, sans base : un simple fichier .data/items.json, pour tester.
//
// Une idée = { id, owner, title, detail, reserved_by, reserved_anon, deleted }
//   owner        : à qui appartient la liste
//   reserved_by  : qui offre ce cadeau (null si personne)
//   reserved_anon: true si la personne qui offre veut rester secrète
//   deleted      : idée retirée par son propriétaire alors qu'elle était déjà réservée
//                  (on la garde le temps de prévenir celui qui l'avait réservée)
import fs from 'node:fs';
import path from 'node:path';

let cached;

export async function getStore() {
  if (cached) return cached;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) cached = await pgStore(url);
  else if (process.env.VERCEL) {
    throw Object.assign(new Error("La base de données n'est pas encore reliée au projet Vercel."), { status: 500 });
  } else cached = fileStore();
  return cached;
}

async function pgStore(url) {
  const { neon } = await import('@neondatabase/serverless');
  const sql = neon(url);
  await sql`CREATE TABLE IF NOT EXISTS items (
    id SERIAL PRIMARY KEY,
    owner TEXT NOT NULL,
    title TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',
    reserved_by TEXT,
    reserved_anon BOOLEAN NOT NULL DEFAULT FALSE,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  return {
    all: () => sql`SELECT id, owner, title, detail, reserved_by, reserved_anon, deleted FROM items ORDER BY id`,
    async add(owner, title, detail) {
      await sql`INSERT INTO items (owner, title, detail) VALUES (${owner}, ${title}, ${detail})`;
    },
    async remove(id, owner) {
      // Pas réservée : on efface. Réservée : on la masque et on préviendra celui qui l'offrait.
      const gone = await sql`DELETE FROM items WHERE id = ${id} AND owner = ${owner} AND reserved_by IS NULL RETURNING id`;
      if (gone.length) return true;
      const hidden = await sql`UPDATE items SET deleted = TRUE WHERE id = ${id} AND owner = ${owner} RETURNING id`;
      return hidden.length > 0;
    },
    async reserve(id, me, anon) {
      // Une seule requête : si deux personnes cliquent en même temps, une seule gagne.
      const ok = await sql`UPDATE items SET reserved_by = ${me}, reserved_anon = ${anon}
        WHERE id = ${id} AND owner <> ${me} AND reserved_by IS NULL AND NOT deleted RETURNING id`;
      if (ok.length) return 'ok';
      const row = await sql`SELECT owner, deleted FROM items WHERE id = ${id}`;
      if (!row.length || row[0].deleted) return 'missing';
      return row[0].owner === me ? 'own' : 'taken';
    },
    async cancel(id, me) {
      const r = await sql`UPDATE items SET reserved_by = NULL, reserved_anon = FALSE
        WHERE id = ${id} AND reserved_by = ${me} AND NOT deleted RETURNING id`;
      return r.length > 0;
    },
    async dismiss(id, me) {
      const r = await sql`DELETE FROM items WHERE id = ${id} AND reserved_by = ${me} AND deleted RETURNING id`;
      return r.length > 0;
    },
  };
}

function fileStore() {
  const dir = process.env.ENVIES_DATA_DIR || path.join(process.cwd(), '.data');
  const file = path.join(dir, 'items.json');
  const load = () => {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return { next: 1, items: [] }; }
  };
  const save = (db) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(db, null, 2)); };
  return {
    async all() { return load().items; },
    async add(owner, title, detail) {
      const db = load();
      db.items.push({ id: db.next++, owner, title, detail, reserved_by: null, reserved_anon: false, deleted: false });
      save(db);
    },
    async remove(id, owner) {
      const db = load();
      const it = db.items.find((i) => i.id === id && i.owner === owner);
      if (!it) return false;
      if (it.reserved_by) it.deleted = true;
      else db.items = db.items.filter((i) => i !== it);
      save(db);
      return true;
    },
    async reserve(id, me, anon) {
      const db = load();
      const it = db.items.find((i) => i.id === id);
      if (!it || it.deleted) return 'missing';
      if (it.owner === me) return 'own';
      if (it.reserved_by) return 'taken';
      it.reserved_by = me; it.reserved_anon = anon;
      save(db);
      return 'ok';
    },
    async cancel(id, me) {
      const db = load();
      const it = db.items.find((i) => i.id === id && i.reserved_by === me && !i.deleted);
      if (!it) return false;
      it.reserved_by = null; it.reserved_anon = false;
      save(db);
      return true;
    },
    async dismiss(id, me) {
      const db = load();
      const before = db.items.length;
      db.items = db.items.filter((i) => !(i.id === id && i.reserved_by === me && i.deleted));
      save(db);
      return db.items.length < before;
    },
  };
}
