// Validation de cible commune aux competences et aux sorts.

const { isAlive } = require("../units");

/** Unite vivante `targetId`, du bon camp selon `targetType` ("ally" /
 * "enemy" ; tout autre type n'impose aucun camp). Leve une erreur sinon. */
function requireUnitTarget(state, playerId, targetId, targetType) {
  const target = state.units[targetId];
  if (!isAlive(target)) throw new Error("Cible invalide.");
  if (targetType === "ally" && target.ownerId !== playerId) throw new Error("Cible alliee requise.");
  if (targetType === "enemy" && target.ownerId === playerId) throw new Error("Cible ennemie requise.");
  return target;
}

module.exports = { requireUnitTarget };
