// Cycle de vie d'une partie hors tours de jeu : creation, salon d'attente,
// choix des decks, lancement, deconnexions.

const hex = require("./hexGrid");
const { addLog } = require("./log");
const { uid, genCode, shuffle } = require("./random");
const { sanitizeOptions } = require("./options");
const { championsById, playableCardDef } = require("./catalog");
const { makeChampionUnit } = require("./units");
const { createMines } = require("./mines");
const { drawCard, eliminatePlayer } = require("./turns");
const { STARTING_HAND, MIN_DECK_SIZE, MAX_DECK_NAME_LENGTH } = require("./constants");

function newPlayer(id, name) {
  return {
    id,
    name: name || "Joueur",
    side: null,
    championId: null,
    championUnitId: null,
    deckName: null,
    deckCardIds: [],
    deck: [],
    hand: [],
    graveyard: [],   // defausse : sorts utilises (voir option "reshuffleDiscard")
    cardUses: {},    // limites d'utilisation par carte/sort (voir game/usage.js)
    mana: 0,
    maxMana: 0,      // limite de mana : cout maximal d'une carte, et mana gagne a chaque debut de tour
    quarters: 0,     // quarts de mana accumules (voir mines.js#collectMineQuarters)
    ready: false,
    connected: true,
    eliminated: false
  };
}

function createGame(hostId, hostName, { maxPlayers, options } = {}) {
  const players = maxPlayers === 4 ? 4 : 2;
  return {
    code: genCode(),
    status: "waiting", // waiting -> playing -> finished
    maxPlayers: players,
    boardConfig: hex.createBoard(players),
    options: sanitizeOptions(options),
    players: {
      [hostId]: newPlayer(hostId, hostName)
    },
    order: [hostId],      // ordre d'arrivee / attribution des cotes (stable)
    turnOrder: [],         // ordre de jeu reel, retrecit quand un joueur est elimine
    currentTurnIndex: 0,
    turnNumber: 1,
    turnStartedAt: null,
    units: {},
    mudCells: new Set(), // cases boueuses (voir sort "Jet d'eau") -- cle "q,r", permanentes pour la partie
    traps: {},           // voir game/traps.js
    mines: [],           // voir game/mines.js -- creees au lancement (startGame)
    winnerId: null,
    log: []
  };
}

function joinGame(state, guestId, guestName) {
  if (state.status !== "waiting") throw new Error("La partie a deja commence.");
  if (Object.keys(state.players).length >= state.maxPlayers) throw new Error("La partie est pleine.");
  state.players[guestId] = newPlayer(guestId, guestName);
  state.order.push(guestId);
  return state;
}

function setPlayerLoadout(state, playerId, { championId, deckCardIds, deckName }) {
  const player = state.players[playerId];
  if (!player) throw new Error("Joueur inconnu.");
  if (!championsById[championId]) throw new Error("Champion invalide.");
  const validDeck = (deckCardIds || []).filter(id => playableCardDef(id));
  if (validDeck.length < MIN_DECK_SIZE) {
    throw new Error(`Deck invalide : ${MIN_DECK_SIZE - validDeck.length} carte(s) manquante(s) (minimum ${MIN_DECK_SIZE}).`);
  }
  player.championId = championId;
  player.deckCardIds = validDeck;
  player.deckName = (deckName || "").toString().trim().slice(0, MAX_DECK_NAME_LENGTH) || "Deck";
  player.ready = true;
  addLog(state, `${player.name} a choisi son deck (${player.deckName}).`);
}

function allPlayersReady(state) {
  const ids = Object.keys(state.players);
  return ids.length === state.maxPlayers && ids.every(id => state.players[id].ready);
}

function startGame(state) {
  if (state.status !== "waiting") return;
  if (!allPlayersReady(state)) return;

  state.status = "playing";
  const seats = state.boardConfig.seats;
  state.order.forEach((pid, i) => {
    state.players[pid].side = seats[i];
  });
  state.turnOrder = state.order.slice();

  for (const pid of state.order) {
    const player = state.players[pid];
    // Le deck utilise en partie est EXACTEMENT celui choisi dans le deckbuilder :
    // memes cartes, memes quantites (deckCardIds contient deja les doublons).
    player.deck = shuffle(player.deckCardIds).map(cardId => ({ instanceId: uid("card"), cardId }));
    player.hand = [];
    player.graveyard = [];
    for (let i = 0; i < STARTING_HAND; i++) drawCard(state, pid);

    const start = state.boardConfig.championStart(player.side);
    const championUnit = makeChampionUnit(player.championId, pid, player.side, start);
    state.units[championUnit.id] = championUnit;
    player.championUnitId = championUnit.id;

    player.maxMana = 1;
    player.mana = 1;
    player.quarters = 0;
  }

  state.mines = createMines(state);

  state.currentTurnIndex = 0;
  state.turnNumber = 1;
  state.turnStartedAt = Date.now();
  addLog(state, `La partie commence. Au tour de ${state.players[state.turnOrder[0]].name}.`);
}

/** Deconnexion. Salon d'attente : la place est reellement liberee (evite le
 * bug "partie complete" apres un depart avant lancement). Partie en cours :
 * traite comme un abandon. */
function removePlayer(state, playerId) {
  if (state.status === "waiting") {
    delete state.players[playerId];
    state.order = state.order.filter(id => id !== playerId);
    return;
  }
  if (state.status === "playing") {
    const player = state.players[playerId];
    if (player) player.connected = false;
    eliminatePlayer(state, playerId);
  }
}

module.exports = {
  createGame,
  joinGame,
  setPlayerLoadout,
  allPlayersReady,
  startGame,
  removePlayer
};
