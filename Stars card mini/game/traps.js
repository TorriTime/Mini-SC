// Pieges (sort "Piege") : state.traps = id -> { id, ownerId, q, r }.
// Un piege n'est JAMAIS envoye a un adversaire, pas meme son existence :
// seul son proprietaire le voit (voir trapsVisibleTo).

const { uid } = require("./random");
const { addLog } = require("./log");

function placeTrap(state, ownerId, cell) {
  const trap = { id: uid("trap"), ownerId, q: cell.q, r: cell.r };
  state.traps[trap.id] = trap;
  return trap;
}

/** Declenche les pieges ENNEMIS presents sur les cases traversees (hors
 * case de depart, incluse dans `path`). Pas d'effet de declenchement
 * complexe pour l'instant : le piege est simplement consomme et revele
 * (log partage -- une fois declenche, il n'a plus de raison de rester
 * secret). Ne se declenche jamais sur son propre piege. */
function triggerTrapsAlongPath(state, unit, path) {
  const triggered = [];
  for (let i = 1; i < path.length; i++) {
    const cell = path[i];
    for (const trap of Object.values(state.traps)) {
      if (trap.ownerId === unit.ownerId) continue;
      if (trap.q !== cell.q || trap.r !== cell.r) continue;
      delete state.traps[trap.id];
      triggered.push({ trapId: trap.id, q: cell.q, r: cell.r });
      addLog(state, `${unit.name} declenche un piege !`);
    }
  }
  return triggered;
}

function trapsVisibleTo(state, viewerId) {
  return Object.values(state.traps)
    .filter(t => t.ownerId === viewerId)
    .map(t => ({ id: t.id, q: t.q, r: t.r }));
}

module.exports = { placeTrap, triggerTrapsAlongPath, trapsVisibleTo };
