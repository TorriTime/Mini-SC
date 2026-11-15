// Deplacement anime : le serveur envoie le chemin REEL (calcule et valide
// par lui) juste avant l'etat mis a jour. On fait "sauter" le jeton d'une
// case a l'autre en redessinant le plateau a chaque etape -- la position
// finale, elle, vient toujours de l'etat serveur (aucune donnee de position
// n'est inventee cote client).

import { socket } from "../socket.js";
import { session, refreshBoard } from "./session.js";

const MOVE_STEP_MS = 160;

function redraw() {
  if (session.state) refreshBoard();
}

function animateMove(unitId, path) {
  if (!path || path.length < 2) return;
  const previous = session.animations[unitId];
  if (previous && previous.timer) clearInterval(previous.timer);

  let step = 0;
  const timer = setInterval(() => {
    step++;
    if (step >= path.length) {
      clearInterval(timer);
      delete session.animations[unitId];
    } else {
      session.animations[unitId] = { q: path[step].q, r: path[step].r, timer };
    }
    redraw();
  }, MOVE_STEP_MS);
  session.animations[unitId] = { q: path[0].q, r: path[0].r, timer };
  redraw();
}

export function initAnimations() {
  socket.on("unitMoved", ({ unitId, path }) => animateMove(unitId, path));
}
