// Ecran de jeu : assemble le HUD, la main, le plateau et les panneaux.

import { session, setRenderers } from "./session.js";
import { renderBoard } from "./board.js";
import { renderHand } from "./hand.js";
import { renderHud, initHud, stopTurnTimer } from "./hud.js";
import { initAnimations } from "./animations.js";

export { stopTurnTimer };

/** Affiche l'etat de partie `state` recu du serveur. */
export function renderGame(state) {
  session.state = state;
  renderHud();
  renderHand();
  renderBoard();
}

export function initGame() {
  setRenderers({ board: renderBoard, hand: renderHand });
  initHud();
  initAnimations();
}
