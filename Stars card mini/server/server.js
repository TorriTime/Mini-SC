const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const cards = require("../data/cards");
const spells = require("../data/spells");
const champions = require("../data/champions");
const abilities = require("../data/abilities");
const patchNotes = require("../data/patchNotes");
const gs = require("../game/gameState");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "..", "public")));

// Donnees publiques du jeu (cartes/champions/competences) consommees par le
// client. no-store : evite qu'un navigateur serve une reponse mise en cache
// apres une modification des fichiers data/*.js + redemarrage du serveur
// (ces fichiers ne sont lus qu'une fois, au demarrage du processus Node --
// voir stars.bat pour relancer).
app.use("/api", (req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
app.get("/api/cards", (req, res) => res.json(cards));
app.get("/api/spells", (req, res) => res.json(spells));
app.get("/api/champions", (req, res) => res.json(champions));
app.get("/api/abilities", (req, res) => res.json(abilities));
app.get("/api/patchnotes", (req, res) => res.json(patchNotes));

// games en memoire : code -> gameState
const games = new Map();
// socketId -> code (pour retrouver rapidement la partie d'un joueur)
const socketToGame = new Map();
// code -> Timeout du chronometre de tour (option "turnTimerSeconds")
const turnTimers = new Map();

function broadcastState(code) {
  const state = games.get(code);
  if (!state) return;
  for (const playerId of Object.keys(state.players)) {
    io.to(playerId).emit("state", gs.serializeForPlayer(state, playerId));
  }
}

function fail(socket, message) {
  socket.emit("errorMessage", message);
}

function clearTurnTimer(code) {
  const t = turnTimers.get(code);
  if (t) clearTimeout(t);
  turnTimers.delete(code);
}

// Chronometre de tour SERVEUR-AUTORITAIRE : le client se contente d'afficher
// un compte a rebours calcule depuis `turnStartedAt`/`turnRemainingSeconds`
// (etat envoye par le serveur), il ne decide jamais seul que le temps est
// ecoule. Idempotent : peut etre rappelee apres n'importe quelle action sans
// effet de bord, elle se resynchronise toujours sur l'etat reel.
function scheduleTurnTimer(code) {
  clearTurnTimer(code);
  const state = games.get(code);
  if (!state || state.status !== "playing") return;
  const secs = state.options.turnTimerSeconds;
  if (!secs || !state.turnStartedAt) return;

  const remainingMs = Math.max(0, secs * 1000 - (Date.now() - state.turnStartedAt));
  const timer = setTimeout(() => {
    const s = games.get(code);
    if (!s || s.status !== "playing") return;
    try {
      const active = gs.activePlayerId(s);
      if (active) gs.endTurn(s, active);
    } catch (e) { /* le tour a peut-etre deja change entre temps, on ignore */ }
    broadcastState(code);
    scheduleTurnTimer(code);
  }, remainingMs);
  turnTimers.set(code, timer);
}

io.on("connection", socket => {
  socket.on("createGame", ({ name, maxPlayers, options } = {}) => {
    try {
      const state = gs.createGame(socket.id, name, { maxPlayers, options });
      games.set(state.code, state);
      socketToGame.set(socket.id, state.code);
      socket.join(state.code);
      socket.emit("gameCreated", { code: state.code });
      broadcastState(state.code);
    } catch (e) {
      fail(socket, e.message);
    }
  });

  socket.on("joinGame", ({ code, name } = {}) => {
    try {
      const upper = (code || "").toUpperCase().trim();
      const state = games.get(upper);
      if (!state) throw new Error("Partie introuvable.");
      gs.joinGame(state, socket.id, name);
      socketToGame.set(socket.id, upper);
      socket.join(upper);
      socket.emit("gameJoined", { code: upper });
      broadcastState(upper);
    } catch (e) {
      fail(socket, e.message);
    }
  });

  socket.on("setLoadout", ({ championId, deckCardIds, deckName } = {}) => {
    try {
      const code = socketToGame.get(socket.id);
      const state = games.get(code);
      if (!state) throw new Error("Aucune partie active.");
      gs.setPlayerLoadout(state, socket.id, { championId, deckCardIds, deckName });
      if (gs.allPlayersReady(state)) {
        gs.startGame(state);
        scheduleTurnTimer(code);
      }
      broadcastState(code);
    } catch (e) {
      fail(socket, e.message);
    }
  });

  socket.on("playCard", ({ instanceId, q, r } = {}) => {
    withGame(socket, state => gs.playCard(state, socket.id, instanceId, q, r));
  });

  socket.on("moveUnit", ({ unitId, q, r } = {}) => {
    withGame(socket, state => gs.moveUnit(state, socket.id, unitId, q, r));
  });

  socket.on("attackUnit", ({ attackerId, targetId } = {}) => {
    withGame(socket, state => gs.attackUnit(state, socket.id, attackerId, targetId));
  });

  socket.on("useAbility", ({ casterId, abilityId, targetId } = {}) => {
    withGame(socket, state => gs.useAbility(state, socket.id, casterId, abilityId, targetId));
  });

  socket.on("castSpell", ({ instanceId, targetId, targetCell } = {}) => {
    withGame(socket, state => gs.castSpell(state, socket.id, instanceId, targetId, targetCell));
  });

  socket.on("endTurn", () => {
    withGame(socket, state => gs.endTurn(state, socket.id));
  });

  socket.on("forfeit", () => {
    withGame(socket, state => gs.forfeit(state, socket.id));
  });

  socket.on("requestReachable", ({ unitId } = {}, ack) => {
    try {
      const code = socketToGame.get(socket.id);
      const state = games.get(code);
      if (!state) throw new Error("Aucune partie active.");
      const cells = gs.getReachableForUnit(state, unitId);
      if (typeof ack === "function") ack({ ok: true, cells });
    } catch (e) {
      if (typeof ack === "function") ack({ ok: false, error: e.message });
    }
  });

  socket.on("rematch", () => {
    try {
      const code = socketToGame.get(socket.id);
      const oldState = games.get(code);
      if (!oldState) return;
      const ids = oldState.order;
      const newState = gs.createGame(ids[0], oldState.players[ids[0]].name, {
        maxPlayers: oldState.maxPlayers,
        options: oldState.options
      });
      newState.code = code; // garder le meme code/salon pour tous les joueurs
      for (let i = 1; i < ids.length; i++) {
        gs.joinGame(newState, ids[i], oldState.players[ids[i]].name);
      }
      games.set(code, newState);
      for (const id of ids) socketToGame.set(id, code);
      clearTurnTimer(code);
      broadcastState(code);
    } catch (e) {
      fail(socket, e.message);
    }
  });

  socket.on("disconnect", () => {
    const code = socketToGame.get(socket.id);
    if (!code) return;
    const state = games.get(code);
    if (state) {
      gs.removePlayer(state, socket.id);
      broadcastState(code);
      scheduleTurnTimer(code);
    }
    socketToGame.delete(socket.id);
  });

  function withGame(socket, fn) {
    try {
      const code = socketToGame.get(socket.id);
      const state = games.get(code);
      if (!state) throw new Error("Aucune partie active.");
      const result = fn(state);
      broadcastUnitMovedIfAny(state, result);
      broadcastState(code);
      scheduleTurnTimer(code);
    } catch (e) {
      fail(socket, e.message);
    }
  }

  // Emet "unitMoved" (deplacement normal ou Charge -- les deux renvoient
  // {unit/unitId, path, triggeredTraps}, voir game/gameState.js) pour
  // declencher l'animation cote client. Envoye a CHAQUE joueur separement
  // (jamais une diffusion room-wide brute) car une unite invisible ne doit
  // pas fuiter son trajet aux joueurs qui ne peuvent pas la voir -- meme
  // regle que gs.serializeForPlayer pour state.units.
  function broadcastUnitMovedIfAny(state, result) {
    if (!result || !result.path || result.path.length < 2) return;
    const unitId = result.unitId || (result.unit && result.unit.id);
    const unit = state.units[unitId];
    if (!unit) return;
    for (const playerId of Object.keys(state.players)) {
      if (!gs.isUnitVisibleTo(unit, playerId)) continue;
      io.to(playerId).emit("unitMoved", {
        unitId,
        path: result.path,
        triggeredTraps: result.triggeredTraps || []
      });
    }
  }
});

server.listen(PORT, () => {
  console.log(`Stars Cards mini server running on http://localhost:${PORT}`);
});
