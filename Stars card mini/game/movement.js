// Deplacement sur la grille : cases accessibles et plus court chemin, par un
// meme parcours en largeur (BFS simple, sans cout de terrain).
//
// `board` est l'objet plateau de LA partie en cours (game/hexGrid.js#createBoard),
// jamais une constante globale : plusieurs parties de tailles differentes
// (2 ou 4 joueurs) peuvent tourner en meme temps sur le serveur.
//
// `occupied` : Set de cles "q,r" des cases occupees par une unite VIVANTE
// (voir battlefield.js#occupiedSet). Une unite ne traverse jamais une case
// occupee.

const { key: keyOf } = require("./hexGrid");

/**
 * Parcours en largeur depuis `from`, limite a `movement` pas. Retourne une
 * Map cle -> { q, r, dist, parentKey } dans l'ordre de decouverte. Si
 * `stopAtKey` est fourni, le parcours s'arrete des que cette case est atteinte.
 *
 * Plusieurs chemins de meme longueur sont possibles sur une grille
 * hexagonale : `board.neighbors()` explore TOUJOURS les 6 directions dans
 * le meme ordre fixe, en commencant par la case "a droite" (voir
 * NEIGHBOR_DIRS dans hexGrid.js) -- comme le BFS ne retient que le premier
 * parent qui atteint une case, ce choix privilegie de facon deterministe
 * et reproductible les chemins passant par la droite en cas d'egalite,
 * plutot que de trancher au hasard.
 */
function explore(board, from, movement, occupied, stopAtKey = null) {
  const startKey = keyOf(from.q, from.r);
  const visited = new Map([[startKey, { q: from.q, r: from.r, dist: 0, parentKey: null }]]);
  let frontier = [startKey];

  while (frontier.length > 0 && !(stopAtKey && visited.has(stopAtKey))) {
    const next = [];
    for (const currentKey of frontier) {
      const current = visited.get(currentKey);
      if (current.dist >= movement) continue;
      for (const n of board.neighbors(current.q, current.r)) {
        const k = keyOf(n.q, n.r);
        if (visited.has(k) || occupied.has(k)) continue;
        visited.set(k, { q: n.q, r: n.r, dist: current.dist + 1, parentKey: currentKey });
        next.push(k);
      }
    }
    frontier = next;
  }
  return visited;
}

/** Cases {q,r} atteignables depuis `from` en au plus `movement` pas (case de depart exclue). */
function reachableCells(board, from, movement, occupied) {
  const visited = explore(board, from, movement, occupied);
  visited.delete(keyOf(from.q, from.r));
  return Array.from(visited.values(), node => ({ q: node.q, r: node.r }));
}

/**
 * Chemin le plus court entre deux cases (memes regles que reachableCells),
 * utilise pour l'animation de deplacement ET pour detecter les pieges
 * traverses en route (voir traps.js#triggerTrapsAlongPath).
 * Retourne la liste des cases DE DEPART A DESTINATION (les deux incluses),
 * ou null si la destination n'est pas atteignable.
 */
function shortestPath(board, from, to, movement, occupied) {
  const targetKey = keyOf(to.q, to.r);
  const visited = explore(board, from, movement, occupied, targetKey);
  if (!visited.has(targetKey)) return null;

  const path = [];
  for (let k = targetKey; k; k = visited.get(k).parentKey) {
    const node = visited.get(k);
    path.unshift({ q: node.q, r: node.r });
  }
  return path;
}

module.exports = { reachableCells, shortestPath };
