// Les membres de la famille.
// Ils viennent du réglage FAMILLE : des prénoms séparés par des virgules, dans l'ordre d'affichage.
//   FAMILLE=Alice,Bernard,Chloé,David,Emma,Félix
// Chaque prénom donne un identifiant sans accent ni majuscule ("Chloé" devient "chloe").
// Cet identifiant relie chaque idée à sa personne : changer un prénom en cours de route
// revient à créer une nouvelle personne, avec une liste vide et un nouveau lien.
const EXEMPLE = 'Alice,Bernard,Chloé,David,Emma,Félix';

const slug = (name) => name.normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

let cached;

export function getPeople() {
  if (cached) return cached;
  let raw = process.env.FAMILLE;
  if (!raw) {
    if (process.env.VERCEL) {
      throw Object.assign(new Error("La variable FAMILLE n'est pas définie sur Vercel."), { status: 500 });
    }
    raw = EXEMPLE; // sur son ordinateur, sans réglage : une famille d'exemple
  }
  const people = raw.split(',').map((n) => n.trim()).filter(Boolean).map((name) => ({ id: slug(name), name }));
  const ids = new Set(people.map((p) => p.id));
  if (people.length < 2 || ids.size !== people.length || ids.has('')) {
    throw Object.assign(new Error('FAMILLE doit contenir au moins deux prénoms, tous différents.'), { status: 500 });
  }
  cached = people;
  return cached;
}

export const byId = (id) => getPeople().find((p) => p.id === id) || null;
