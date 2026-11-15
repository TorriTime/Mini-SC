// Mines : domination (mine de camp ou tour d'ouvrier), zones sures, quarts
// de mana et installation des Ouvriers.
//
// Une mine : { id, q, r, homeOwnerId, unsafeOwnerId }. Le proprietaire n'est
// JAMAIS stocke : il est recalcule a chaque appel (voir mineOwnerId).

const hex = require("./hexGrid");
const { addLog } = require("./log");
const { isAlive, makeTower } = require("./units");
const { MINE_RADIUS, SAFE_RADIUS, QUARTERS_PER_MANA, MAX_MANA } = require("./constants");

/** Mines de la partie, creees au lancement a partir des sites du plateau. */
function createMines(state) {
  return state.boardConfig.mineSites().map((site, i) => {
    const homeOwner = site.home ? state.order.find(pid => state.players[pid].side === site.home) : null;
    return { id: `mine_${i}`, q: site.q, r: site.r, homeOwnerId: homeOwner || null, unsafeOwnerId: null };
  });
}

function mineCells(board, mine) {
  const cells = [{ q: mine.q, r: mine.r }];
  for (const n of board.neighbors(mine.q, mine.r)) {
    if (hex.cubeDistance(n, mine) <= MINE_RADIUS) cells.push(n);
  }
  return cells;
}

function isMineCell(state, q, r) {
  return state.mines.some(m => hex.cubeDistance({ q, r }, m) <= MINE_RADIUS);
}

function towerOfMine(state, mine) {
  return Object.values(state.units).find(u =>
    u.isTower && u.mineId === mine.id && isAlive(u) && u.q === mine.q && u.r === mine.r
  ) || null;
}

/** Tours d'ouvrier vivantes de `playerId` adjacentes a la case (q,r) :
 * elles autorisent le deploiement avance (voir actions/deploy.js). */
function ownTowersAdjacentTo(state, playerId, q, r) {
  return Object.values(state.units).filter(u =>
    u.isTower && u.ownerId === playerId && isAlive(u) && hex.cubeDistance(u, { q, r }) === 1
  );
}

/** Proprietaire de la mine, calcule a chaque appel (jamais stocke) : le
 * joueur de camp pour une mine de camp, sinon le proprietaire de la tour
 * vivante. */
function mineOwnerId(state, mine) {
  if (mine.homeOwnerId) {
    const p = state.players[mine.homeOwnerId];
    return p && !p.eliminated ? mine.homeOwnerId : null;
  }
  const tower = towerOfMine(state, mine);
  return tower ? tower.ownerId : null;
}

/** Zone sure : la mine est controlee et n'a pas ete "troublee" depuis (voir
 * markAggressionNearMines). unsafeOwnerId evite de garder un etat obsolete
 * quand la mine change de main. */
function isMineSafe(state, mine) {
  const owner = mineOwnerId(state, mine);
  return !!owner && mine.unsafeOwnerId !== owner;
}

function isInSafeZone(state, unit) {
  return state.mines.some(m =>
    mineOwnerId(state, m) === unit.ownerId && isMineSafe(state, m) &&
    hex.cubeDistance(unit, m) <= SAFE_RADIUS
  );
}

/** Une attaque ennemie contre une unite situee a cote (SAFE_RADIUS + 1) d'une
 * mine controlee par la victime rend la zone non sure : le bonus de
 * deplacement s'arrete immediatement. Elle redevient sure au debut du tour
 * de son proprietaire s'il n'y a plus d'ennemi dans la zone. */
function markAggressionNearMines(state, attacker, victim) {
  if (!attacker || !victim || attacker.ownerId === victim.ownerId) return;
  for (const mine of state.mines) {
    if (mineOwnerId(state, mine) !== victim.ownerId) continue;
    if (hex.cubeDistance(victim, mine) > SAFE_RADIUS + 1) continue;
    if (mine.unsafeOwnerId !== victim.ownerId) {
      mine.unsafeOwnerId = victim.ownerId;
      addLog(state, `Une zone sure de ${state.players[victim.ownerId].name} n'est plus sure.`);
    }
  }
}

function restoreSafeZones(state, playerId) {
  for (const mine of state.mines) {
    if (mine.unsafeOwnerId !== playerId) continue;
    const enemyNear = Object.values(state.units).some(u =>
      isAlive(u) && u.ownerId !== playerId && hex.cubeDistance(u, mine) <= SAFE_RADIUS
    );
    if (!enemyNear) mine.unsafeOwnerId = null;
  }
}

/** Debut de tour : chaque mine controlee donne un quart de mana max (sauf si
 * une unite a ete deployee a cote de sa tour au tour precedent). 4 quarts =
 * +1 de limite de mana definitive. */
function collectMineQuarters(state, player) {
  let gained = 0;
  for (const mine of state.mines) {
    if (mineOwnerId(state, mine) !== player.id) continue;
    const tower = towerOfMine(state, mine);
    if (tower && tower.skipQuarter) { tower.skipQuarter = false; continue; }
    gained++;
  }
  player.quarters += gained;
  while (player.quarters >= QUARTERS_PER_MANA && player.maxMana < MAX_MANA) {
    player.quarters -= QUARTERS_PER_MANA;
    player.maxMana += 1;
    addLog(state, `${player.name} augmente sa limite de mana a ${player.maxMana}.`);
  }
  if (player.maxMana >= MAX_MANA) player.quarters = Math.min(player.quarters, QUARTERS_PER_MANA - 1);
}

/** Marque (ou annule) l'installation d'un Ouvrier apres un deplacement. */
function updateWorkerSettling(state, unit) {
  delete unit.settlingMineId;
  if (!unit.isWorker) return;
  const mine = state.mines.find(m => !m.homeOwnerId && m.q === unit.q && m.r === unit.r);
  if (mine && !towerOfMine(state, mine)) unit.settlingMineId = mine.id;
}

/** Un Ouvrier qui est reste un tour complet au centre d'une mine (marque a
 * son arrivee, valide au debut du tour suivant de son proprietaire) devient
 * une tour d'ouvrier. */
function completeWorkerSettling(state, playerId) {
  for (const unit of Object.values(state.units)) {
    if (unit.ownerId !== playerId || !unit.settlingMineId || !isAlive(unit)) continue;
    const mine = state.mines.find(m => m.id === unit.settlingMineId);
    delete unit.settlingMineId;
    if (!mine || mine.homeOwnerId || unit.q !== mine.q || unit.r !== mine.r) continue;
    delete state.units[unit.id];
    const tower = makeTower(unit.ownerId, unit.side, mine);
    state.units[tower.id] = tower;
    addLog(state, `${state.players[playerId].name} construit une tour et domine une mine.`);
  }
}

module.exports = {
  createMines,
  mineCells,
  isMineCell,
  towerOfMine,
  ownTowersAdjacentTo,
  mineOwnerId,
  isMineSafe,
  isInSafeZone,
  markAggressionNearMines,
  restoreSafeZones,
  collectMineQuarters,
  updateWorkerSettling,
  completeWorkerSettling
};
