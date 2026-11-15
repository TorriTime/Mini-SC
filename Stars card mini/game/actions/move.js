// Action "deplacer une unite".

const { shortestPath } = require("../movement");
const { unitAt, occupiedSet, ownsUnit, effectiveMovement } = require("../battlefield");
const { updateWorkerSettling } = require("../mines");
const { triggerTrapsAlongPath } = require("../traps");
const { assertTurn } = require("../turns");

/** Retourne { unit, path, triggeredTraps } : `path` est le chemin REEL
 * parcouru, utilise pour l'animation cote client. */
function moveUnit(state, playerId, unitId, q, r) {
  assertTurn(state, playerId);
  const unit = state.units[unitId];
  if (!ownsUnit(state, playerId, unit)) throw new Error("Unite invalide.");
  if (unit.hasMoved) throw new Error("Cette unite a deja bouge.");
  if (unitAt(state, q, r)) throw new Error("Case occupee.");

  const path = shortestPath(state.boardConfig, unit, { q, r }, effectiveMovement(state, unit), occupiedSet(state, unitId));
  if (!path) throw new Error("Case hors de portee de deplacement.");

  unit.q = q;
  unit.r = r;
  unit.hasMoved = true;
  updateWorkerSettling(state, unit);

  const triggeredTraps = triggerTrapsAlongPath(state, unit, path);
  return { unit, path, triggeredTraps };
}

module.exports = { moveUnit };
