// Calcul des cases accessibles par une unite en fonction de sa
// statistique de deplacement (BFS simple, pas d'obstacles/terrain).
//
// `board` est l'objet plateau de LA partie en cours (game/hexGrid.js#createBoard),
// jamais une constante globale : plusieurs parties de tailles differentes
// (2 ou 4 joueurs) peuvent tourner en meme temps sur le serveur.

const { key: keyOf } = require("./hexGrid");

/**
 * Retourne la liste des cases {q,r} atteignables depuis (startQ,startR)
 * en au plus `movement` pas, sans traverser de case occupee.
 * occupiedSet: Set de "q,r" occupees par une unite VIVANTE (voir
 * gameState.js#occupiedSet, qui ne doit lister que des unites avec health>0).
 */
function reachableCells(board, startQ, startR, movement, occupiedSet) {
  const visited = new Map();
  visited.set(keyOf(startQ, startR), 0);
  let frontier = [{ q: startQ, r: startR, dist: 0 }];

  while (frontier.length > 0) {
    const next = [];
    for (const cell of frontier) {
      if (cell.dist >= movement) continue;
      for (const n of board.neighbors(cell.q, cell.r)) {
        const k = keyOf(n.q, n.r);
        if (visited.has(k)) continue;
        if (occupiedSet.has(k)) continue; // impossible de traverser une unite
        visited.set(k, cell.dist + 1);
        next.push({ q: n.q, r: n.r, dist: cell.dist + 1 });
      }
    }
    frontier = next;
  }

  visited.delete(keyOf(startQ, startR));
  return Array.from(visited.keys()).map(k => {
    const [q, r] = k.split(",").map(Number);
    return { q, r };
  });
}

function isReachable(board, startQ, startR, targetQ, targetR, movement, occupiedSet) {
  if (!board.inBounds(targetQ, targetR)) return false;
  return reachableCells(board, startQ, startR, movement, occupiedSet)
    .some(c => c.q === targetQ && c.r === targetR);
}

/**
 * Chemin le plus court (BFS, memes regles que reachableCells) entre deux
 * cases, utilise pour l'animation de deplacement ET pour detecter les
 * pieges traverses en route (voir gameState.js#triggerTrapsAlongPath).
 * Retourne la liste des cases DE DEPART A DESTINATION (les deux incluses),
 * ou null si la destination n'est pas atteignable.
 *
 * Plusieurs chemins de meme longueur sont possibles sur une grille
 * hexagonale : `board.neighbors()` explore TOUJOURS les 6 directions dans
 * le meme ordre fixe, en commencant par la case "a droite" (voir
 * NEIGHBOR_DIRS dans hexGrid.js) -- comme le BFS ne retient que le premier
 * parent qui atteint une case, ce choix privilegie de facon deterministe
 * et reproductible les chemins passant par la droite en cas d'egalite,
 * plutot que de trancher au hasard.
 */
function shortestPath(board, startQ, startR, targetQ, targetR, movement, occupiedSet) {
  const startKey = keyOf(startQ, startR);
  const targetKey = keyOf(targetQ, targetR);
  if (startKey === targetKey) return [{ q: startQ, r: startR }];

  const visited = new Map();
  visited.set(startKey, { q: startQ, r: startR, dist: 0, parentKey: null });
  let frontier = [{ q: startQ, r: startR }];

  while (frontier.length > 0) {
    if (visited.has(targetKey)) break;
    const next = [];
    for (const cell of frontier) {
      const dist = visited.get(keyOf(cell.q, cell.r)).dist;
      if (dist >= movement) continue;
      for (const n of board.neighbors(cell.q, cell.r)) {
        const k = keyOf(n.q, n.r);
        if (visited.has(k)) continue;
        if (occupiedSet.has(k)) continue;
        visited.set(k, { q: n.q, r: n.r, dist: dist + 1, parentKey: keyOf(cell.q, cell.r) });
        next.push(n);
      }
    }
    frontier = next;
  }

  if (!visited.has(targetKey)) return null;

  const path = [];
  let curKey = targetKey;
  while (curKey) {
    const node = visited.get(curKey);
    path.unshift({ q: node.q, r: node.r });
    curKey = node.parentKey;
  }
  return path;
}

module.exports = { reachableCells, isReachable, shortestPath };
