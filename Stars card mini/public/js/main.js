// Point d'entree du client. Le serveur est seul maitre de l'etat de partie :
// a chaque evenement "state", on affiche l'ecran correspondant au statut.
//
// Organisation de public/js/ :
//   menu.js, deckBuilder.js, lobby.js   ecrans hors partie
//   game/                               ecran de jeu (plateau, main, panneaux, HUD)
//   deckStore.js                        decks sauvegardes (localStorage)
//   catalog.js                          donnees du jeu chargees depuis /api
//   views.js, hex.js, tooltip.js, dom.js, html.js, socket.js   outils partages

import { $, onClick, showScreen, isScreenActive } from "./dom.js";
import { socket } from "./socket.js";
import { loadCatalog } from "./catalog.js";
import { initTooltips } from "./tooltip.js";
import { initMenu, renderPatchNotes } from "./menu.js";
import { initDeckBuilder, renderDeckBuilder } from "./deckBuilder.js";
import { initLobby, renderLobby } from "./lobby.js";
import { initGame, renderGame, stopTurnTimer } from "./game/index.js";
import { session } from "./game/session.js";

const ERROR_DISPLAY_MS = 2500;

function showEndScreen(state) {
  stopTurnTimer();
  const winner = state.players[state.winnerId];
  $("end-title").textContent = state.winnerId
    ? `${winner ? winner.name : "Personne"} remporte la partie !`
    : "Partie terminee.";
  showScreen("screen-end");
}

/** Erreur renvoyee par le serveur : dans la banniere pendant une partie
 * (message temporaire), sinon sous le formulaire "rejoindre". */
function showError(message) {
  if (!isScreenActive("screen-game")) {
    $("join-status").textContent = message;
    return;
  }
  const banner = $("game-banner");
  banner.textContent = message;
  setTimeout(() => { if (banner.textContent === message) banner.textContent = ""; }, ERROR_DISPLAY_MS);
}

initTooltips();
initMenu();
initDeckBuilder();
initLobby();
initGame();
onClick("btn-rematch", () => socket.emit("rematch"));

socket.on("state", state => {
  session.state = state;
  if (state.status === "waiting") {
    renderLobby(state);
  } else if (state.status === "playing") {
    showScreen("screen-game");
    renderGame(state);
  } else if (state.status === "finished") {
    showEndScreen(state);
  }
});
socket.on("errorMessage", showError);

loadCatalog().then(() => {
  renderDeckBuilder();
  renderPatchNotes();
});
