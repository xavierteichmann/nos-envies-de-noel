// Les règles du jeu. C'est ici que le secret est garanti :
// le serveur n'envoie JAMAIS au propriétaire d'une liste la moindre information
// sur les réservations de ses propres idées. Ce n'est pas "caché à l'écran",
// l'information ne quitte tout simplement pas le serveur.
import { getPeople, byId } from './people.js';
import { getStore } from './store.js';

const MAX_TITLE = 120;
const MAX_DETAIL = 300;
const MAX_ITEMS = 60;

export async function buildState(me) {
  const store = await getStore();
  const rows = await store.all();
  const people = getPeople();
  const lists = Object.fromEntries(people.map((p) => [p.id, []]));
  const notices = [];

  for (const r of rows) {
    if (!lists[r.owner]) continue;
    if (r.deleted) {
      // Idée retirée par son propriétaire : seul celui qui l'avait réservée est prévenu.
      if (r.reserved_by === me.id) {
        notices.push({ id: r.id, title: r.title, ownerName: byId(r.owner).name });
      }
      continue;
    }
    if (r.owner === me.id) {
      // Ma propre liste : aucune trace des réservations.
      lists[r.owner].push({ id: r.id, title: r.title, detail: r.detail });
      continue;
    }
    const item = { id: r.id, title: r.title, detail: r.detail, status: 'free' };
    if (r.reserved_by === me.id) {
      item.status = 'mine';
      item.anon = !!r.reserved_anon;
    } else if (r.reserved_by) {
      item.status = 'taken';
      item.by = r.reserved_anon ? null : (byId(r.reserved_by)?.name ?? null);
    }
    lists[r.owner].push(item);
  }

  return { me: { id: me.id, name: me.name }, people, lists, notices };
}

const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// Exécute une action et renvoie { message? } (message = explication si l'action n'a pas abouti).
export async function act(me, body) {
  const store = await getStore();
  const id = Number(body?.id);
  switch (body?.type) {
    case 'add': {
      const title = clean(body.title, MAX_TITLE);
      if (!title) return { message: "Écris d'abord ton idée de cadeau." };
      const mine = (await store.all()).filter((i) => i.owner === me.id && !i.deleted);
      if (mine.length >= MAX_ITEMS) return { message: 'Ta liste est pleine. Retire une idée pour en ajouter une autre.' };
      await store.add(me.id, title, clean(body.detail, MAX_DETAIL));
      return {};
    }
    case 'remove':
      await store.remove(id, me.id);
      return {};
    case 'reserve': {
      const res = await store.reserve(id, me.id, !!body.anon);
      if (res === 'taken') return { message: "Quelqu'un vient de prendre ce cadeau juste avant toi." };
      if (res === 'missing') return { message: "Cette idée vient d'être retirée de la liste." };
      if (res === 'own') return { message: 'Tu ne peux pas réserver un cadeau de ta propre liste.' };
      return {};
    }
    case 'cancel':
      await store.cancel(id, me.id);
      return {};
    case 'dismiss':
      await store.dismiss(id, me.id);
      return {};
    default:
      throw Object.assign(new Error('Action inconnue.'), { status: 400 });
  }
}
