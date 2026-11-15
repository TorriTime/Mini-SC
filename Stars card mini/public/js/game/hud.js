// Habillage de l'ecran de jeu autour du plateau : banniere de tour,
// chronometre, champions et mana des joueurs, fin de tour et abandon.

import { $, onClick } from "../dom.js";
import { socket } from "../socket.js";
import { healthPercent, healthColor, manaLabel } from "../views.js";
import { session, myId, myPlayer, isMyTurn } from "./session.js";

function championOf(playerId) {
  return Object.values(session.state.units).find(u => u.isChampion && u.ownerId === playerId);
}

// ---- Chronometre de tour ----
// Purement un affichage : le SERVEUR est seul juge du moment ou le tour se
// termine reellement (voir server/gameRooms.js#scheduleTurnTimer). Ce compte
// a rebours local ne fait qu'interpoler entre deux mises a jour d'etat.
let turnTimerInterval = null;

export function stopTurnTimer() {
  if (turnTimerInterval) clearInterval(turnTimerInterval);
  turnTimerInterval = null;
}

function renderTurnTimer() {
  const el = $("turn-timer");
  stopTurnTimer();
  let remaining = session.state.turnRemainingSeconds;
  if (remaining == null) { el.textContent = ""; return; }
  const show = () => { el.textContent = `Temps restant : ${remaining}s`; };
  show();
  turnTimerInterval = setInterval(() => {
    remaining = Math.max(0, remaining - 1);
    show();
    if (remaining <= 0) stopTurnTimer();
  }, 1000);
}

// ---- Joueurs ----
function renderMyChampion() {
  const el = $("champion-badge-player");
  const nameEl = el.querySelector(".champion-name");
  const fillEl = el.querySelector(".hp-fill");
  const champion = championOf(myId());
  if (!champion) { nameEl.textContent = "?"; fillEl.style.width = "0%"; return; }
  const pct = healthPercent(champion);
  nameEl.textContent = `${champion.name} (${champion.health}/${champion.maxHealth})${champion.health <= 0 ? " - KO" : ""}`;
  fillEl.style.width = pct + "%";
  fillEl.style.background = healthColor(pct);
}

// Adversaires : 1 en 2 joueurs, jusqu'a 3 en 4 joueurs.
function renderOpponents() {
  const state = session.state;
  const row = $("opponent-row");
  row.innerHTML = "";
  state.order.filter(id => id !== state.you).forEach(id => {
    const player = state.players[id];
    const champion = championOf(id);
    const pct = champion ? healthPercent(champion) : 0;
    const status = player.eliminated ? " - elimine" : (champion && champion.health <= 0 ? " - KO" : "");
    const div = document.createElement("div");
    div.className = "mini-champion-badge" + (player.eliminated ? " eliminated" : "");
    div.innerHTML = `
      <div class="champion-name">${player.name}${status}</div>
      <div class="hp-bar"><div class="hp-fill" style="width:${pct}%; background:${healthColor(pct)};"></div></div>
      <div class="mana-badge">${manaLabel(player)}</div>
    `;
    row.appendChild(div);
  });
}

export function renderHud() {
  const state = session.state;
  const activeName = state.activePlayerId ? state.players[state.activePlayerId].name : "?";
  $("game-banner").textContent = isMyTurn() ? "A TOI DE JOUER" : `Tour de ${activeName}`;
  $("sandbox-badge").classList.toggle("active", !!state.options.sandbox);
  renderTurnTimer();
  renderMyChampion();
  $("mana-badge-player").textContent = manaLabel(myPlayer());
  renderOpponents();
  $("btn-end-turn").disabled = !isMyTurn();
  $("btn-forfeit").disabled = myPlayer().eliminated;
}

// ---- Abandon (double confirmation) ----
function initForfeitDialog() {
  const overlay = $("forfeit-overlay");
  const showStep = step => {
    $("forfeit-step-1").style.display = step === 1 ? "" : "none";
    $("forfeit-step-2").style.display = step === 2 ? "" : "none";
  };
  const close = () => overlay.classList.remove("active");

  onClick("btn-forfeit", () => { showStep(1); overlay.classList.add("active"); });
  onClick("btn-forfeit-next", () => showStep(2));
  onClick("btn-forfeit-cancel-1", close);
  onClick("btn-forfeit-cancel-2", close);
  onClick("btn-forfeit-confirm", () => { socket.emit("forfeit"); close(); });
}

export function initHud() {
  onClick("btn-end-turn", () => socket.emit("endTurn"));
  initForfeitDialog();
}
