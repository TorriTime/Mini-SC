// Geometrie du plateau hexagonal cote affichage.
//
// Le plateau est un vrai RECTANGLE en coordonnees "offset" (colonne/ligne,
// disposition "odd-q" pour hexagones a sommet plat) -- meme conversion que
// cote serveur (game/hexGrid.js). Les q,r (axiaux) restent utilises tels
// quels pour toute la logique (distance, cle de case).

export const HEX_SIZE = 34;
export const HEX_WIDTH = HEX_SIZE * 2;
export const HEX_HEIGHT = HEX_SIZE * Math.sqrt(3);

export function offsetToAxial(col, row) {
  return { q: col, r: row - (col - (col & 1)) / 2 };
}

/** Position en pixels (coin haut-gauche) de la case a la colonne/ligne donnee. */
export function hexPixel(col, row) {
  return {
    x: HEX_SIZE * 1.5 * col,
    y: HEX_SIZE * Math.sqrt(3) * (row + 0.5 * (col & 1))
  };
}

/** Dimensions en pixels d'un plateau de cols x rows cases. */
export function boardPixelSize(cols, rows) {
  let maxX = 0, maxY = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const p = hexPixel(col, row);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }
  return { width: maxX + HEX_WIDTH, height: maxY + HEX_HEIGHT };
}

export function cubeDistance(a, b) {
  const ax = a.q, az = a.r, ay = -ax - az;
  const bx = b.q, bz = b.r, by = -bx - bz;
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(az - bz));
}

/** Cle "q,r" d'une case (meme format que le serveur). */
export const cellKey = cell => `${cell.q},${cell.r}`;

// Une seule grille logique cote serveur. Chaque joueur voit SON cote en bas
// de son ecran grace a une simple rotation CSS du conteneur #board
// (0/90/180/270 selon son siege) : les cases restent les memes elements DOM
// lies aux memes coordonnees q,r, donc les clics restent corrects sans aucun
// recalcul de coordonnees.
export const SEAT_ROTATION = { bottom: 0, right: 90, top: 180, left: 270 };
