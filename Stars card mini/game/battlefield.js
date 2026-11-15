// Requetes sur l'etat du plateau : qui occupe quelle case, deplacement reel
// d'une unite (boue, zones sures), reduction de degats par aura.
// Aucune mutation ici.

const hex = require("./hexGrid");
const { reachableCells } = require("./movement");
const { isAlive } = require("./units");
const { isInSafeZone } = require("./mines");
const { SAFE_MIN_MOVEMENT } = require("./constants");

/** Unite VIVANTE occupant la case (q,r), ou null. */
function unitAt(state, q, r) {
  return Object.values(state.units).find(u => isAlive(u) && u.q === q && u.r === r) || null;
}

/** Cles "q,r" des cases occupees par une unite vivante (hors `excludeUnitId`). */
function occupiedSet(state, excludeUnitId) {
  const s = new Set();
  for (const u of Object.values(state.units)) {
    if (u.id === excludeUnitId) continue;
    if (!isAlive(u)) continue;
    s.add(hex.key(u.q, u.r));
  }
  return s;
}

function ownsUnit(state, playerId, unit) {
  return !!unit && unit.ownerId === playerId && isAlive(unit);
}

/** Case libre la plus proche de `cell` (elle-meme si elle est libre). */
function findFreeCellNear(state, cell) {
  if (!unitAt(state, cell.q, cell.r)) return cell;
  const board = state.boardConfig;
  const visited = new Set([hex.key(cell.q, cell.r)]);
  let frontier = [cell];
  while (frontier.length > 0) {
    const next = [];
    for (const c of frontier) {
      for (const n of board.neighbors(c.q, c.r)) {
        const k = hex.key(n.q, n.r);
        if (visited.has(k)) continue;
        visited.add(k);
        if (!unitAt(state, n.q, n.r)) return n;
        next.push(n);
      }
    }
    frontier = next;
  }
  return cell; // aucune case libre trouvee (plateau plein) : on retourne l'originale
}

/** Deplacement REELLEMENT utilisable par une unite CE tour, calcule
 * dynamiquement selon la case OU SE TROUVE ACTUELLEMENT l'unite (jamais
 * stocke sur l'unite elle-meme -- une unite qui quitte la boue redevient
 * immediatement normale, sans jamais depasser sa vraie limite de deplacement). */
function effectiveMovement(state, unit) {
  let movement = unit.movement;
  // Zone sure : au moins 2 de deplacement, peu importe la mobilite de base
  // (une unite immobilisee, ex : tour ou Sniper a l'arret, reste a 0).
  if (movement > 0 && movement < SAFE_MIN_MOVEMENT && isInSafeZone(state, unit)) {
    movement = SAFE_MIN_MOVEMENT;
  }
  // Boue (voir sort "Jet d'eau") : -1, minimum 1.
  if (state.mudCells.has(hex.key(unit.q, unit.r))) {
    return Math.max(1, movement - 1);
  }
  return movement;
}

/** Cases atteignables par l'unite `unitId` avec son deplacement reel. */
function getReachableForUnit(state, unitId) {
  const unit = state.units[unitId];
  if (!unit) return [];
  return reachableCells(state.boardConfig, unit, effectiveMovement(state, unit), occupiedSet(state, unitId));
}

/** Reduction de degats subis par `unit` (ex : Noyau celeste) : multiplicateur
 * 1 - reduction, jamais cumulee (on retient la meilleure aura alliee). */
function damageMultiplier(state, unit) {
  let best = 0;
  for (const u of Object.values(state.units)) {
    if (!u.aura || !isAlive(u) || u.ownerId !== unit.ownerId) continue;
    if (hex.cubeDistance(u, unit) <= u.aura.radius) best = Math.max(best, u.aura.damageReduction);
  }
  return 1 - best;
}

module.exports = {
  unitAt,
  occupiedSet,
  ownsUnit,
  findFreeCellNear,
  effectiveMovement,
  getReachableForUnit,
  damageMultiplier
};
