// Maths de grille hexagonale + generation du plateau.
//
// Les unites et toute la logique de jeu (deplacement, portee, voisins)
// continuent de raisonner en coordonnees AXIALES (q,r) -- cubeDistance et
// neighbors ne changent jamais de definition, seule la taille/forme du
// plateau (donc ce qui est "in bounds") varie selon le nombre de joueurs.
//
// Chaque partie possede son PROPRE objet plateau (cree via createBoard),
// car plusieurs parties de tailles differentes (2 ou 4 joueurs) tournent
// simultanement sur le meme serveur : aucune constante globale mutable.
//
// Cote presentation, le plateau est genere comme un vrai RECTANGLE en
// coordonnees "offset" (colonne/ligne, disposition "odd-q" pour hexagones
// a sommet plat) puis converti en axial. Cela evite l'effet de
// parallelogramme/losange etire qu'on obtient en prenant directement un
// rectangle de coordonnees axiales brutes, tout en gardant exactement les
// memes formules de distance/voisinage.

function offsetToAxial(col, row) {
  const q = col;
  const r = row - (col - (col & 1)) / 2;
  return { q, r };
}

function axialToOffset(q, r) {
  const col = q;
  const row = r + (q - (q & 1)) / 2;
  return { col, row };
}

function key(q, r) {
  return `${q},${r}`;
}

function cubeDistance(a, b) {
  const ax = a.q, az = a.r, ay = -ax - az;
  const bx = b.q, bz = b.r, by = -bx - bz;
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(az - bz));
}

function cubeRound(x, y, z) {
  let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
  const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
  if (dx > dy && dx > dz) rx = -ry - rz;
  else if (dy > dz) ry = -rx - rz;
  else rz = -rx - ry;
  return { x: rx, y: ry, z: rz };
}

/**
 * Ligne hexagonale entre deux cases (incluses), utilisee par la Charge
 * (verification de ligne de vue) et Perforation (unites traversees par le
 * tir). Interpolation lineaire en coordonnees cube puis arrondi -- une
 * ligne coherente et stable, meme quand plusieurs tracés seraient possibles.
 */
function hexLine(a, b) {
  const n = cubeDistance(a, b);
  if (n === 0) return [{ q: a.q, r: a.r }];
  const ax = a.q, az = a.r, ay = -ax - az;
  const bx = b.q, bz = b.r, by = -bx - bz;
  const results = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    const z = az + (bz - az) * t;
    const c = cubeRound(x, y, z);
    results.push({ q: c.x, r: c.z });
  }
  return results;
}

const NEIGHBOR_DIRS = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 }
];

// 2 joueurs : plateau haut/bas (identique a la version precedente).
// 4 joueurs : plateau plus grand, carre, avec une zone par cote (bas, haut,
// gauche, droite). Meme taille de case hexagonale (HEX_SIZE inchangee
// cote client) -- seul le NOMBRE de cases augmente.
const BOARD_2P = { cols: 9, rows: 10, seats: ["bottom", "top"] };
const BOARD_4P = { cols: 13, rows: 13, seats: ["bottom", "top", "left", "right"] };

function boardConfigFor(maxPlayers) {
  return maxPlayers >= 3 ? BOARD_4P : BOARD_2P;
}

/**
 * Cree l'objet plateau utilise par UNE partie. Toute la logique de jeu
 * (gameState.js, movement.js) recoit cet objet en parametre plutot que de
 * s'appuyer sur des constantes globales.
 */
function createBoard(maxPlayers) {
  const { cols: COLS, rows: ROWS, seats } = boardConfigFor(maxPlayers);

  function inBounds(q, r) {
    const { col, row } = axialToOffset(q, r);
    return col >= 0 && col < COLS && row >= 0 && row < ROWS;
  }

  function neighbors(q, r) {
    return NEIGHBOR_DIRS
      .map(d => ({ q: q + d.q, r: r + d.r }))
      .filter(p => inBounds(p.q, p.r));
  }

  function allCells() {
    const cells = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) cells.push(offsetToAxial(col, row));
    }
    return cells;
  }

  // Zones de deploiement, une par cote, sans chevauchement aux coins :
  // haut/bas revendiquent leurs 2 lignes sur TOUTES les colonnes ; gauche/
  // droite revendiquent leurs 2 colonnes uniquement sur les lignes du milieu
  // (celles deja prises par haut/bas sont exclues).
  const EDGE = 2;
  function deployZone(side) {
    const cells = [];
    if (side === "bottom" || side === "top") {
      const rows = side === "bottom" ? [ROWS - 1, ROWS - 2] : [0, 1];
      for (let row = 0; row < ROWS; row++) {
        if (!rows.includes(row)) continue;
        for (let col = 0; col < COLS; col++) cells.push(offsetToAxial(col, row));
      }
    } else if (side === "left" || side === "right") {
      const cols = side === "left" ? [0, 1] : [COLS - 1, COLS - 2];
      for (let row = EDGE; row < ROWS - EDGE; row++) {
        for (let col = 0; col < COLS; col++) {
          if (!cols.includes(col)) continue;
          cells.push(offsetToAxial(col, row));
        }
      }
    }
    return cells;
  }

  function championStart(side) {
    if (side === "bottom") return offsetToAxial(Math.floor(COLS / 2), ROWS - 1);
    if (side === "top") return offsetToAxial(Math.floor(COLS / 2), 0);
    if (side === "left") return offsetToAxial(0, Math.floor(ROWS / 2));
    return offsetToAxial(COLS - 1, Math.floor(ROWS / 2)); // "right"
  }

  return {
    cols: COLS,
    rows: ROWS,
    seats,
    inBounds,
    neighbors,
    allCells,
    deployZone,
    championStart,
    key,
    cubeDistance,
    hexLine,
    offsetToAxial,
    axialToOffset
  };
}

module.exports = {
  createBoard,
  boardConfigFor,
  key,
  cubeDistance,
  hexLine,
  offsetToAxial,
  axialToOffset
};
