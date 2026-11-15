// Menu principal, patch notes, ecran d'options et creation / acces a une partie.

import { $, onClick, showScreen } from "./dom.js";
import { socket } from "./socket.js";
import { catalog } from "./catalog.js";
import { deckIsValid } from "./deckStore.js";
import { openDeckBuilder, updateDeckWarning } from "./deckBuilder.js";

export function playerName() {
  return $("input-player-name").value.trim() || "Joueur";
}

// Options de la partie a creer (voir game/options.js cote serveur).
const gameOptions = {
  maxPlayers: 2,
  retaliate: true,
  reshuffleDiscard: false,
  handLimit: null,
  turnTimerSeconds: null,
  sandbox: false
};

const parseBoolean = v => v === "true";
const parseOptionalNumber = v => (v ? Number(v) : null);

/** Groupe de boutons a choix unique : le bouton clique devient "selected"
 * et sa valeur (data-value) est rangee dans gameOptions[optionName]. */
function wireChoiceGroup(containerId, optionName, parse) {
  const buttons = $(containerId).querySelectorAll(".choice-btn");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      gameOptions[optionName] = parse(btn.dataset.value);
    });
  });
}

export function renderPatchNotes() {
  $("patchnotes-list").innerHTML = catalog.patchNotes.map(entry => `
    <div class="patch-entry">
      <h3>Version ${entry.version}</h3>
      ${entry.title ? `<p class="patch-title">${entry.title}</p>` : ""}
      <ul>${entry.changes.map(c => `<li>${c}</li>`).join("")}</ul>
    </div>
  `).join("");
  const latest = catalog.patchNotes[0];
  if (latest) $("version-tag").textContent = `Version ${latest.version}`;
}

export function initMenu() {
  onClick("btn-create", () => showScreen("screen-options"));
  onClick("btn-join", () => showScreen("screen-join"));
  onClick("btn-deck", openDeckBuilder);
  onClick("btn-patchnotes", () => showScreen("screen-patchnotes"));
  for (const id of ["btn-patchnotes-back", "btn-create-back", "btn-join-back", "btn-options-back", "btn-end-menu"]) {
    onClick(id, () => showScreen("screen-menu"));
  }

  wireChoiceGroup("opt-maxplayers", "maxPlayers", Number);
  wireChoiceGroup("opt-retaliate", "retaliate", parseBoolean);
  wireChoiceGroup("opt-reshuffle", "reshuffleDiscard", parseBoolean);
  wireChoiceGroup("opt-handlimit", "handLimit", parseOptionalNumber);
  wireChoiceGroup("opt-timer", "turnTimerSeconds", parseOptionalNumber);
  wireChoiceGroup("opt-sandbox", "sandbox", parseBoolean);

  onClick("btn-options-create", () => {
    // Deck incomplet : on renvoie au deckbuilder plutot que de creer la partie.
    if (!deckIsValid()) { openDeckBuilder(); updateDeckWarning(); return; }
    socket.emit("createGame", { name: playerName(), maxPlayers: gameOptions.maxPlayers, options: gameOptions });
  });

  onClick("btn-join-confirm", () => {
    socket.emit("joinGame", { code: $("input-join-code").value, name: playerName() });
  });
}
