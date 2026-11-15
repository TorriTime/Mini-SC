// Acces indexe (par id) aux donnees de data/. Les index sont des objets
// SANS prototype : un id venu du client ("constructor", "__proto__"...) ne
// peut jamais correspondre par accident a une propriete heritee.

const cards = require("../data/cards");
const spells = require("../data/spells");
const champions = require("../data/champions");
const abilitiesById = require("../data/abilities");

function indexById(list) {
  const index = Object.create(null);
  for (const entry of list) index[entry.id] = entry;
  return index;
}

const cardsById = indexById(cards);
const spellsById = indexById(spells);
const championsById = indexById(champions);

/** Cartes jouables depuis la main : unites (data/cards.js) + sorts (data/spells.js). */
function playableCardDef(id) {
  return cardsById[id] || spellsById[id];
}

module.exports = { cardsById, spellsById, championsById, abilitiesById, playableCardDef };
