// Outils communs aux tests du moteur de jeu.

const gs = require("../game/gameState");
const hex = require("../game/hexGrid");
const { makeUnitFromCard } = require("../game/units");

const BASIC_DECK = Array(10).fill("soldier");

/** Case du plateau en coordonnees "offset" (colonne, ligne) -> axiales {q,r}.
 * Deux cases d'une meme colonne sont a une distance egale a leur ecart de lignes. */
const cell = (col, row) => hex.offsetToAxial(col, row);

/** Partie lancee : p1 a la main, chaque joueur a son Champion et 5 cartes. */
function startedGame({ players = 2, options = {}, champions = [] } = {}) {
  const ids = Array.from({ length: players }, (_, i) => `p${i + 1}`);
  const state = gs.createGame(ids[0], "Alice", { maxPlayers: players, options });
  ids.slice(1).forEach((id, i) => gs.joinGame(state, id, `Joueur ${i + 2}`));
  ids.forEach((id, i) => gs.setPlayerLoadout(state, id, {
    championId: champions[i] || "kael", deckCardIds: BASIC_DECK, deckName: "Test"
  }));
  gs.startGame(state);
  return { state, ids };
}

/** Pose directement une unite sur le plateau (sans regle de deploiement ni cout). */
function spawn(state, playerId, cardId, col, row) {
  const unit = makeUnitFromCard(cardId, playerId, state.players[playerId].side, cell(col, row));
  state.units[unit.id] = unit;
  return unit;
}

let nextInstance = 0;
/** Ajoute une carte a la main du joueur ; retourne son instanceId. */
function give(state, playerId, cardId) {
  const instanceId = `test_card_${nextInstance++}`;
  state.players[playerId].hand.push({ instanceId, cardId });
  return instanceId;
}

function setMana(state, playerId, mana, maxMana = mana) {
  state.players[playerId].mana = mana;
  state.players[playerId].maxMana = maxMana;
}

function championOf(state, playerId) {
  return state.units[state.players[playerId].championUnitId];
}

/** Deplace une unite sans passer par les regles (mise en place d'un scenario). */
function teleport(unit, col, row) {
  Object.assign(unit, cell(col, row));
  return unit;
}

/** Termine le tour de chaque joueur une fois : retour au joueur actif courant. */
function fullRound(state) {
  const count = state.turnOrder.length;
  for (let i = 0; i < count; i++) gs.endTurn(state, gs.activePlayerId(state));
}

module.exports = { gs, hex, cell, startedGame, spawn, give, setMana, championOf, teleport, fullRound, BASIC_DECK };
