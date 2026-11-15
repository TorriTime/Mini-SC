// Salon d'attente : code de la partie, joueurs presents, options, et choix
// du deck que chaque joueur utilisera pour CETTE partie.

import { $, onClick, showScreen } from "./dom.js";
import { socket } from "./socket.js";
import { championById } from "./catalog.js";
import { allDecks, deckById, activeDeck, deckIsValid, MIN_DECK_SIZE } from "./deckStore.js";

const COPIED_MESSAGE = "Code copie !";

function copyWithExecCommand(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(ta);
  return ok;
}

/** Essaie l'API Clipboard moderne, puis retombe sur execCommand si elle est
 * absente OU refuse (permission navigateur, contexte automatise...). */
async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) { /* on retente via le fallback ci-dessous */ }
  }
  try { return copyWithExecCommand(text); } catch (e) { return false; }
}

async function copyGameCode() {
  const feedback = $("copy-feedback");
  const copied = await copyToClipboard($("create-code").textContent);
  feedback.textContent = copied
    ? COPIED_MESSAGE
    : "Impossible de copier automatiquement, selectionne le code manuellement.";
  if (copied) setTimeout(() => { if (feedback.textContent === COPIED_MESSAGE) feedback.textContent = ""; }, 2000);
}

function renderPlayers(state) {
  const el = $("lobby-players");
  el.innerHTML = "";
  for (let i = 0; i < state.maxPlayers; i++) {
    const id = state.order[i];
    const row = document.createElement("div");
    row.className = "lobby-player-row";
    if (id) {
      const p = state.players[id];
      const status = p.ready ? `Deck : ${p.deckName || "?"}` : "Choisit son deck...";
      row.innerHTML = `<span>${p.name}${id === state.you ? " (toi)" : ""}</span><span class="status">${status}</span>`;
    } else {
      row.innerHTML = `<span>En attente...</span><span class="status empty">Place libre</span>`;
    }
    el.appendChild(row);
  }
}

function renderOptions(state) {
  const o = state.options;
  const yesNo = value => (value ? "Oui" : "Non");
  $("lobby-options").innerHTML = `
    <span>Joueurs : ${state.maxPlayers}</span>
    <span>Riposte : ${yesNo(o.retaliate)}</span>
    <span>Remelange defausse : ${yesNo(o.reshuffleDiscard)}</span>
    <span>Limite main : ${o.handLimit ? o.handLimit + " cartes" : "Non"}</span>
    <span>Chrono : ${o.turnTimerSeconds ? o.turnTimerSeconds + "s" : "Non"}</span>
    <span>Bac a sable : ${yesNo(o.sandbox)}</span>
  `;
}

// Choix INDEPENDANT du deck a utiliser pour CETTE partie, parmi les decks
// sauvegardes du joueur. Reste affiche tant que le joueur n'a pas confirme
// (ready === false) ; une fois confirme, le deck est verrouille pour la partie.
let selectedDeckId = null;

function renderDeckPicker(state) {
  const container = $("lobby-deck-picker");
  const myself = state.players[state.you];
  if (!myself || myself.ready) { container.style.display = "none"; container.innerHTML = ""; return; }
  if (!deckById(selectedDeckId)) selectedDeckId = activeDeck().id;

  container.style.display = "";
  container.innerHTML = `
    <h3>Choisis ton deck pour cette partie</h3>
    <div id="lobby-deck-list" class="lobby-deck-list"></div>
    <button id="btn-confirm-deck">CONFIRMER MON DECK</button>
    <p id="lobby-deck-warning" class="deck-warning"></p>
  `;
  const list = $("lobby-deck-list");
  allDecks().forEach(d => {
    const row = document.createElement("div");
    row.className = "lobby-deck-option" + (d.id === selectedDeckId ? " selected" : "");
    const champ = championById(d.championId);
    row.innerHTML = `<b>${d.name}</b><span class="stats">${d.cardIds.length} cartes - ${champ ? champ.name : "?"}</span>`;
    row.addEventListener("click", () => { selectedDeckId = d.id; renderDeckPicker(state); });
    list.appendChild(row);
  });
  onClick("btn-confirm-deck", () => {
    const chosen = deckById(selectedDeckId);
    if (!chosen || !deckIsValid(chosen)) {
      $("lobby-deck-warning").textContent = `Ce deck contient moins de ${MIN_DECK_SIZE} cartes : complete-le dans "Mon Deck" avant de l'utiliser.`;
      return;
    }
    // Le serveur attend { championId, deckCardIds, deckName } (voir game/lobby.js#setPlayerLoadout).
    socket.emit("setLoadout", { championId: chosen.championId, deckCardIds: chosen.cardIds, deckName: chosen.name });
  });
}

export function renderLobby(state) {
  $("create-code").textContent = state.code;
  const count = state.order.length;
  $("create-status").textContent = count < state.maxPlayers
    ? `En attente de ${state.maxPlayers - count} joueur(s)...`
    : "En attente de la configuration des decks...";
  renderPlayers(state);
  renderOptions(state);
  renderDeckPicker(state);
  showScreen("screen-create");
}

export function initLobby() {
  onClick("btn-copy-code", copyGameCode);
}
