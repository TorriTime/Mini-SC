// Donnees publiques du jeu (cartes, sorts, champions, competences, patch
// notes), chargees une fois depuis /api. Ce sont exactement celles
// qu'utilise le moteur cote serveur : l'interface n'invente jamais un texte
// ou une statistique.

export const catalog = {
  cards: [],      // unites
  spells: [],     // sorts
  champions: [],
  abilities: {},  // id -> competence
  patchNotes: []
};

// cache: "no-store" : toujours prendre les donnees fraiches du serveur
// (evite d'afficher une ancienne carte apres une modif + redemarrage).
const fetchJson = name => fetch(`/api/${name}`, { cache: "no-store" }).then(r => r.json());

export async function loadCatalog() {
  const [cards, spells, champions, abilities, patchNotes] = await Promise.all(
    ["cards", "spells", "champions", "abilities", "patchnotes"].map(fetchJson)
  );
  Object.assign(catalog, { cards, spells, champions, abilities, patchNotes });
}

export const isCatalogLoaded = () => catalog.cards.length > 0;

/** Toutes les cartes jouables : unites puis sorts. */
export const playableCards = () => [...catalog.cards, ...catalog.spells];

// Une carte jouable est soit une unite soit un sort -- meme systeme de
// donnees, cardById cherche dans les deux.
export const cardById = id => catalog.cards.find(c => c.id === id) || catalog.spells.find(s => s.id === id);
export const championById = id => catalog.champions.find(c => c.id === id);
export const abilityById = id => catalog.abilities[id];
