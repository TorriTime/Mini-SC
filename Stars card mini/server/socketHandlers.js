// Protocole temps reel : traduit les evenements socket.io des clients en
// appels au moteur de jeu (game/gameState.js), puis diffuse le nouvel etat.
//
// Client -> serveur : createGame, joinGame, setLoadout, rematch,
//                     requestReachable (avec accuse de reception),
//                     et les actions de jeu listees dans GAME_ACTIONS.
// Serveur -> client : gameCreated, gameJoined, state, unitMoved, errorMessage.

const gs = require("../game/gameState");

// Actions de jeu : (state, playerId, donnees envoyees par le client) -> resultat.
const GAME_ACTIONS = {
  playCard: (state, playerId, { instanceId, q, r }) => gs.playCard(state, playerId, instanceId, q, r),
  moveUnit: (state, playerId, { unitId, q, r }) => gs.moveUnit(state, playerId, unitId, q, r),
  attackUnit: (state, playerId, { attackerId, targetId }) => gs.attackUnit(state, playerId, attackerId, targetId),
  useAbility: (state, playerId, { casterId, abilityId, targetId }) => gs.useAbility(state, playerId, casterId, abilityId, targetId),
  castSpell: (state, playerId, { instanceId, targetId, targetCell }) => gs.castSpell(state, playerId, instanceId, targetId, targetCell),
  endTurn: (state, playerId) => gs.endTurn(state, playerId),
  forfeit: (state, playerId) => gs.forfeit(state, playerId)
};

function registerSocketHandlers(io, rooms) {
  io.on("connection", socket => {
    const playerId = socket.id;

    // Tout gestionnaire recoit un objet (jamais null/undefined, quoi que le
    // client envoie) ; une erreur levee est renvoyee au joueur seul.
    const on = (event, handler) => {
      socket.on(event, (payload, ack) => {
        try {
          handler(payload && typeof payload === "object" ? payload : {}, ack);
        } catch (e) {
          socket.emit("errorMessage", e.message);
        }
      });
    };

    on("createGame", ({ name, maxPlayers, options }) => {
      const state = rooms.create(playerId, name, { maxPlayers, options });
      socket.emit("gameCreated", { code: state.code });
      rooms.broadcastState(state.code);
    });

    on("joinGame", ({ code, name }) => {
      const state = rooms.join(playerId, code, name);
      socket.emit("gameJoined", { code: state.code });
      rooms.broadcastState(state.code);
    });

    on("setLoadout", ({ championId, deckCardIds, deckName }) => {
      const state = rooms.requireGameOf(playerId);
      gs.setPlayerLoadout(state, playerId, { championId, deckCardIds, deckName });
      if (gs.allPlayersReady(state)) {
        gs.startGame(state);
        rooms.scheduleTurnTimer(state.code);
      }
      rooms.broadcastState(state.code);
    });

    for (const [event, run] of Object.entries(GAME_ACTIONS)) {
      on(event, payload => {
        const state = rooms.requireGameOf(playerId);
        const result = run(state, playerId, payload);
        rooms.broadcastUnitMoved(state, result);
        rooms.broadcastState(state.code);
        rooms.scheduleTurnTimer(state.code);
      });
    }

    // Seul evenement a accuse de reception : la reponse (ou l'erreur) revient
    // dans `ack`, pas dans un "errorMessage".
    socket.on("requestReachable", (payload, ack) => {
      if (typeof ack !== "function") return;
      try {
        const state = rooms.requireGameOf(playerId);
        ack({ ok: true, cells: gs.getReachableForUnit(state, payload && payload.unitId) });
      } catch (e) {
        ack({ ok: false, error: e.message });
      }
    });

    on("rematch", () => {
      const code = rooms.rematch(playerId);
      if (code) rooms.broadcastState(code);
    });

    socket.on("disconnect", () => rooms.leave(playerId));
  });
}

module.exports = { registerSocketHandlers, GAME_ACTIONS };
