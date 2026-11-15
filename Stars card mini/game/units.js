// Unites posees sur le plateau : fabriques (carte, champion, tour d'ouvrier)
// et predicats ne dependant que de l'unite elle-meme.

const { uid } = require("./random");
const { cardsById, championsById } = require("./catalog");
const { TOWER_HEALTH } = require("./constants");

const TOWER_DEF = {
  id: "tower",
  name: "Tour d'ouvrier",
  attack: 0,
  health: TOWER_HEALTH,
  movement: 0,
  range: 0,
  abilities: []
};

/** Champs communs a toutes les unites, a partir d'une definition de data/. */
function baseUnit(idPrefix, def, ownerId, side, cell) {
  return {
    id: uid(idPrefix),
    ownerId,
    side,
    isChampion: false,
    sourceId: def.id,
    name: def.name,
    attack: def.attack,
    health: def.health,
    maxHealth: def.health,
    movement: def.movement,
    baseMovement: def.movement,
    range: def.range,
    abilities: def.abilities.slice(),
    abilityUses: {}, // limites d'utilisation par competence (voir game/usage.js)
    q: cell.q,
    r: cell.r,
    hasMoved: false,
    hasAttacked: false,
    buffs: []
  };
}

function makeUnitFromCard(cardId, ownerId, side, cell) {
  const card = cardsById[cardId];
  return {
    ...baseUnit("unit", card, ownerId, side, cell),
    isWorker: !!card.isWorker,
    aura: card.aura || null
  };
}

function makeChampionUnit(championId, ownerId, side, cell) {
  const champ = championsById[championId];
  return {
    ...baseUnit("champ", champ, ownerId, side, cell),
    isChampion: true,
    passive: champ.passive,
    // "alternate_movement" (ex: Sniper) : mobile a la creation/reapparition,
    // le passif bascule cet etat au debut de CHAQUE tour du proprietaire
    // (voir game/passives.js) -- jamais sur les tours des autres joueurs.
    canMoveThisTurn: true
  };
}

/** Tour d'ouvrier : creee par un Ouvrier qui a termine son installation au
 * centre d'une mine. Ce n'est pas une carte : elle n'attaque pas, ne bouge
 * pas, et tant qu'elle est vivante son proprietaire domine la mine (voir
 * mines.js#mineOwnerId -- la domination n'est jamais stockee, donc detruire
 * la tour la stoppe instantanement). */
function makeTower(ownerId, side, mine) {
  return {
    ...baseUnit("tower", TOWER_DEF, ownerId, side, mine),
    isTower: true,
    mineId: mine.id,
    skipQuarter: false, // vrai si une unite a ete deployee a cote : le prochain quart n'est pas mine
    hasMoved: true,
    hasAttacked: true
  };
}

// Une unite n'existe sur le plateau que si elle est VIVANTE (health > 0).
// C'est la seule source de verite pour "cette case est libre" : les unites
// non-Champion mortes sont retirees de state.units (voir
// turns.js#resolveDeaths) et les Champions morts sont exclus via `health > 0`.
function isAlive(unit) {
  return !!unit && unit.health > 0;
}

/** Une unite est invisible si elle porte le buff pose par la competence
 * Camouflage (voir game/abilities.js, effet "invisible"). Reutilise le
 * systeme de buffs : expire tout seul via tickBuffs, aucun etat
 * supplementaire a gerer. */
function isInvisible(unit) {
  return !!(unit.buffs || []).some(b => b.type === "invisible");
}

/** Retire immediatement l'invisibilite (attaquer/agir contre un ennemi
 * revele l'unite) -- ne fait rien si elle n'etait pas invisible. */
function revealFromInvisibility(unit) {
  if (!unit.buffs || unit.buffs.length === 0) return;
  unit.buffs = unit.buffs.filter(b => b.type !== "invisible");
}

/** Regle de visibilite unique, utilisee a la fois pour la serialisation par
 * joueur et pour filtrer les evenements d'animation ("unitMoved") : toujours
 * visible pour son proprietaire, jamais pour un adversaire tant qu'elle est
 * invisible. L'unite reste evidemment presente dans l'etat REEL
 * (state.units) quoi qu'il arrive -- ceci ne filtre que ce qui est ENVOYE a
 * tel ou tel joueur. */
function isUnitVisibleTo(unit, viewerId) {
  if (!unit) return false;
  if (unit.ownerId === viewerId) return true;
  return !isInvisible(unit);
}

module.exports = {
  makeUnitFromCard,
  makeChampionUnit,
  makeTower,
  isAlive,
  isInvisible,
  revealFromInvisibility,
  isUnitVisibleTo
};
