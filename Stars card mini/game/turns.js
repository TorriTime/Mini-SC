// Deroulement de la partie : tour actif, pioche, debut/fin de tour, morts,
// eliminations et fin de partie.

const { addLog } = require("./log");
const { shuffle } = require("./random");
const { isAlive } = require("./units");
const { findFreeCellNear } = require("./battlefield");
const { completeWorkerSettling, restoreSafeZones, collectMineQuarters } = require("./mines");
const { gainTurnMana } = require("./mana");
const { tickBuffs } = require("./abilities");
const passives = require("./passives");
const usage = require("./usage");

function activePlayerId(state) {
  if (state.turnOrder.length === 0) return null;
  return state.turnOrder[state.currentTurnIndex % state.turnOrder.length];
}

function assertTurn(state, playerId) {
  if (state.status !== "playing") throw new Error("La partie n'est pas en cours.");
  if (activePlayerId(state) !== playerId) throw new Error("Ce n'est pas votre tour.");
}

/** Pioche une carte. Retourne la carte piochee, ou null si rien n'a ete pioche. */
function drawCard(state, playerId) {
  const player = state.players[playerId];

  if (player.deck.length === 0) {
    if (state.options.reshuffleDiscard && player.graveyard.length > 0) {
      player.deck = shuffle(player.graveyard);
      player.graveyard = [];
      addLog(state, `${player.name} remelange sa defausse dans sa pioche.`);
    } else {
      return null; // pioche (et defausse) vides : on ne pioche simplement rien, aucune carte creee
    }
  }

  const handLimit = state.options.handLimit;
  if (handLimit != null && player.hand.length >= handLimit) {
    return null; // main deja a la limite : la carte n'est pas ajoutee (reste dans la pioche)
  }

  const card = player.deck.shift();
  player.hand.push(card);
  return card;
}

/** Effets de debut de tour de `playerId` (mines, mana, pioche, compteurs, buffs, passif). */
function beginTurn(state, playerId) {
  const player = state.players[playerId];
  // Les mines se resolvent AVANT le gain de mana : une limite qui vient de
  // monter rapporte immediatement plus de mana.
  completeWorkerSettling(state, playerId);
  restoreSafeZones(state, playerId);
  collectMineQuarters(state, player);
  gainTurnMana(player);
  drawCard(state, playerId);
  usage.resetTurnCounters(player.cardUses);

  for (const u of Object.values(state.units)) {
    if (u.ownerId !== playerId) continue;
    tickBuffs(u);
    usage.resetTurnCounters(u.abilityUses);
  }

  const championUnit = state.units[player.championUnitId];
  if (isAlive(championUnit)) passives.onTurnStart(championUnit);
}

/** Donne la main au joueur designe par currentTurnIndex (deja mis a jour). */
function startActiveTurn(state) {
  if (state.currentTurnIndex === 0) state.turnNumber += 1;
  state.turnStartedAt = Date.now();
  const nextId = activePlayerId(state);
  beginTurn(state, nextId);
  addLog(state, `Au tour de ${state.players[nextId].name}.`);
}

function endTurn(state, playerId) {
  assertTurn(state, playerId);

  for (const u of Object.values(state.units)) {
    if (u.ownerId !== playerId) continue;
    u.hasMoved = false;
    u.hasAttacked = false;
    if (u.bonusMovementThisTurn) {
      u.movement -= u.bonusMovementThisTurn;
      u.bonusMovementThisTurn = 0;
    }
  }

  state.currentTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
  startActiveTurn(state);
}

function endGame(state, winnerId) {
  state.status = "finished";
  state.winnerId = winnerId;
  state.turnStartedAt = null;
  if (winnerId) addLog(state, `${state.players[winnerId].name} remporte la partie !`);
  else addLog(state, "Partie terminee.");
}

function eliminatePlayer(state, playerId) {
  const player = state.players[playerId];
  if (!player || player.eliminated || state.status !== "playing") return;

  // Quand le joueur elimine avait la main (ex. son propre Champion meurt
  // d'un degat de zone pendant SON tour), le tour passe au suivant : il faut
  // alors lui appliquer un VRAI debut de tour (mana, pioche, remise a zero
  // des compteurs...), comme le ferait un endTurn() normal -- sinon il
  // "a la main" sans pouvoir rien faire.
  const wasActive = activePlayerId(state) === playerId;

  player.eliminated = true;
  addLog(state, `${player.name} est elimine de la partie.`);

  const idx = state.turnOrder.indexOf(playerId);
  if (idx !== -1) {
    if (idx < state.currentTurnIndex) state.currentTurnIndex -= 1;
    state.turnOrder.splice(idx, 1);
    if (state.turnOrder.length > 0) {
      const n = state.turnOrder.length;
      state.currentTurnIndex = ((state.currentTurnIndex % n) + n) % n;
    }
  }

  const remaining = state.turnOrder.filter(id => !state.players[id].eliminated);
  if (remaining.length <= 1) {
    endGame(state, remaining[0] || null);
    return;
  }

  // Si le joueur elimine n'avait PAS la main, le tour du joueur actif
  // continue normalement : ne pas toucher turnStartedAt (ca prolongerait
  // injustement son chronometre) ni ses effets de tour.
  if (wasActive) startActiveTurn(state);
}

function forfeit(state, playerId) {
  if (state.status !== "playing") throw new Error("Aucune partie en cours.");
  const player = state.players[playerId];
  if (!player || player.eliminated) throw new Error("Vous n'etes plus dans cette partie.");
  addLog(state, `${player.name} abandonne la partie.`);
  eliminatePlayer(state, playerId);
}

/** Bac a sable : un Champion mort reapparait aussitot pres de sa case de depart. */
function respawnChampion(state, unit) {
  const owner = state.players[unit.ownerId];
  const cell = findFreeCellNear(state, state.boardConfig.championStart(owner.side));
  unit.health = unit.maxHealth;
  unit.q = cell.q;
  unit.r = cell.r;
  unit.buffs = [];
  passives.onRespawn(unit);
  addLog(state, `${unit.name} ressuscite instantanement (mode bac a sable).`);
}

/**
 * A appeler apres tout degat, pour chaque unite touchee (dans l'ordre) :
 *  - Champion mort : resurrection immediate en bac a sable, elimination du
 *    joueur sinon (2 joueurs -> l'autre gagne immediatement ; 4 joueurs ->
 *    la partie continue entre les survivants). Le Champion reste dans
 *    state.units mais ne compte plus comme "occupant" une case (isAlive).
 *  - autre unite morte : retiree de state.units.
 */
function resolveDeaths(state, units) {
  for (const unit of units) {
    if (!unit || unit.health > 0) continue;
    if (!unit.isChampion) {
      delete state.units[unit.id];
    } else if (state.options.sandbox) {
      respawnChampion(state, unit);
    } else {
      eliminatePlayer(state, unit.ownerId);
    }
  }
}

module.exports = {
  activePlayerId,
  assertTurn,
  drawCard,
  endTurn,
  eliminatePlayer,
  forfeit,
  resolveDeaths
};
