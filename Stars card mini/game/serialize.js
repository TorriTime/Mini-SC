// Vue de la partie envoyee a UN joueur. Tout le filtrage d'information
// cachee (main adverse, unites invisibles, pieges) se fait ICI, cote
// serveur : ce qu'un joueur ne doit pas savoir est absent du JSON, pas
// seulement masque a l'affichage. state reste seul a faire foi pour les regles.

const hex = require("./hexGrid");
const { isAlive, isInvisible, isUnitVisibleTo } = require("./units");
const { effectiveMovement } = require("./battlefield");
const { mineOwnerId, isMineSafe, mineCells } = require("./mines");
const { trapsVisibleTo } = require("./traps");
const { manaCap } = require("./mana");
const { activePlayerId } = require("./turns");
const { SAFE_RADIUS, LOG_SENT } = require("./constants");

function turnRemainingSeconds(state) {
  const secs = state.options.turnTimerSeconds;
  if (!secs || !state.turnStartedAt || state.status !== "playing") return null;
  const elapsed = (Date.now() - state.turnStartedAt) / 1000;
  return Math.max(0, Math.round(secs - elapsed));
}

function serializePlayers(state, viewerId) {
  const players = {};
  for (const [id, p] of Object.entries(state.players)) {
    players[id] = {
      id: p.id,
      name: p.name,
      side: p.side,
      championId: p.championId,
      deckName: p.deckName,
      mana: p.mana,
      maxMana: p.maxMana,
      manaCap: manaCap(p),
      quarters: p.quarters,
      handCount: p.hand.length,
      deckCount: p.deck.length,
      graveyardCount: p.graveyard.length,
      hand: id === viewerId ? p.hand : undefined,
      connected: p.connected,
      ready: p.ready,
      eliminated: p.eliminated
    };
  }
  return players;
}

/** Copie superficielle par unite (jamais de mutation de state.units), avec
 * le deplacement REEL de ce tour (boue, zone sure) : le client n'a ainsi
 * jamais a reimplementer ces regles pour l'affichage. Une unite adverse
 * invisible est totalement absente du resultat. */
function serializeUnits(state, viewerId) {
  const units = {};
  for (const [id, u] of Object.entries(state.units)) {
    if (!isUnitVisibleTo(u, viewerId)) continue;
    units[id] = {
      ...u,
      effectiveMovement: effectiveMovement(state, u),
      invisible: u.ownerId === viewerId ? isInvisible(u) : undefined
    };
  }
  return units;
}

function serializeMines(state) {
  return state.mines.map(m => ({
    id: m.id,
    q: m.q,
    r: m.r,
    home: !!m.homeOwnerId,
    ownerId: mineOwnerId(state, m),
    safe: isMineSafe(state, m),
    zone: mineCells(state.boardConfig, m),
    safeRadius: SAFE_RADIUS
  }));
}

/** Cases de deploiement du joueur : sa zone de camp + cases a cote de ses
 * tours d'ouvrier (deploiement avance, voir actions/deploy.js). */
function deployCellsFor(state, viewerId) {
  const viewer = state.players[viewerId];
  if (!viewer || !viewer.side) return [];

  const base = state.boardConfig.deployZone(viewer.side);
  const keys = new Set(base.map(c => hex.key(c.q, c.r)));
  const advanced = [];
  for (const t of Object.values(state.units)) {
    if (!t.isTower || t.ownerId !== viewerId || !isAlive(t)) continue;
    for (const n of state.boardConfig.neighbors(t.q, t.r)) {
      const k = hex.key(n.q, n.r);
      if (!keys.has(k)) { keys.add(k); advanced.push(n); }
    }
  }
  return base.map(c => ({ ...c, advanced: false })).concat(advanced.map(c => ({ ...c, advanced: true })));
}

function serializeBoard(board) {
  const deployZones = {};
  for (const side of board.seats) deployZones[side] = board.deployZone(side);
  return { cols: board.cols, rows: board.rows, seats: board.seats, deployZones };
}

function serializeForPlayer(state, viewerId) {
  return {
    code: state.code,
    status: state.status,
    maxPlayers: state.maxPlayers,
    options: state.options,
    players: serializePlayers(state, viewerId),
    order: state.order,
    turnOrder: state.turnOrder,
    activePlayerId: state.status === "playing" ? activePlayerId(state) : null,
    turnNumber: state.turnNumber,
    turnRemainingSeconds: turnRemainingSeconds(state),
    units: serializeUnits(state, viewerId),
    mudCells: Array.from(state.mudCells),
    traps: trapsVisibleTo(state, viewerId),
    mines: serializeMines(state),
    deployCells: deployCellsFor(state, viewerId),
    board: serializeBoard(state.boardConfig),
    winnerId: state.winnerId,
    log: state.log.slice(-LOG_SENT),
    you: viewerId
  };
}

module.exports = { serializeForPlayer };
