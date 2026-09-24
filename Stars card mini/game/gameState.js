// Etat de partie autoritaire (cote serveur) + toutes les mutations.
// Le client n'est jamais source de verite : chaque action passe par une
// fonction ici, qui valide puis mute `gameState`.

const crypto = require("crypto");
const cardsById = require("../data/cards").reduce((m, c) => (m[c.id] = c, m), {});
const spellsById = require("../data/spells").reduce((m, s) => (m[s.id] = s, m), {});
const championsById = require("../data/champions").reduce((m, c) => (m[c.id] = c, m), {});
const abilitiesById = require("../data/abilities");
const hex = require("./hexGrid");
const { reachableCells, isReachable, shortestPath } = require("./movement");
const { inRange, resolveAttack, canRetaliate, effectiveDefense } = require("./combat");
const { inAbilityRange, applyAbilityEffect, tickBuffs } = require("./abilities");
const spells = require("./spells");
const usage = require("./usage");

// Cartes jouables depuis la main : unites (data/cards.js) + sorts (data/spells.js).
function playableCardDef(id) {
  return cardsById[id] || spellsById[id];
}

const STARTING_HAND = 5;
const MAX_MANA = 10;
const MIN_DECK_SIZE = 10;

const DEFAULT_OPTIONS = {
  retaliate: true,
  reshuffleDiscard: false,
  handLimit: null,        // null | 5 | 7 | 9
  turnTimerSeconds: null, // null | 20 | 40 | 60
  sandbox: false
};

function sanitizeOptions(raw) {
  raw = raw || {};
  const handLimit = [5, 7, 9].includes(raw.handLimit) ? raw.handLimit : null;
  const turnTimerSeconds = [20, 40, 60].includes(raw.turnTimerSeconds) ? raw.turnTimerSeconds : null;
  return {
    retaliate: raw.retaliate !== false,
    reshuffleDiscard: !!raw.reshuffleDiscard,
    handLimit,
    turnTimerSeconds,
    sandbox: !!raw.sandbox
  };
}

function uid(prefix) {
  return `${prefix}_${crypto.randomBytes(4).toString("hex")}`;
}

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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
    traps: {},           // id -> { id, ownerId, q, r } -- jamais envoye tel quel a un adversaire (voir serializeForPlayer)
    winnerId: null,
    log: []
  };
}

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
    maxMana: 0,
    ready: false,
    connected: true,
    eliminated: false
  };
}

function addLog(state, message) {
  state.log.push(message);
  if (state.log.length > 50) state.log.shift();
}

function joinGame(state, guestId, guestName) {
  if (state.status !== "waiting") throw new Error("La partie a deja commence.");
  const ids = Object.keys(state.players);
  if (ids.length >= state.maxPlayers) throw new Error("La partie est pleine.");
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
  player.deckName = (deckName || "").toString().trim().slice(0, 40) || "Deck";
  player.ready = true;
  addLog(state, `${player.name} a choisi son deck (${player.deckName}).`);
}

function allPlayersReady(state) {
  const ids = Object.keys(state.players);
  return ids.length === state.maxPlayers && ids.every(id => state.players[id].ready);
}

function makeUnitFromCard(cardId, ownerId, side, q, r) {
  const card = cardsById[cardId];
  return {
    id: uid("unit"),
    ownerId,
    side,
    isChampion: false,
    sourceId: card.id,
    name: card.name,
    attack: card.attack,
    health: card.health,
    maxHealth: card.health,
    movement: card.movement,
    baseMovement: card.movement,
    range: card.range,
    abilities: card.abilities.slice(),
    abilityUses: {},
    q, r,
    hasMoved: false,
    hasAttacked: false,
    buffs: []
  };
}

function makeChampionUnit(championId, ownerId, side, q, r) {
  const champ = championsById[championId];
  return {
    id: uid("champ"),
    ownerId,
    side,
    isChampion: true,
    sourceId: champ.id,
    name: champ.name,
    attack: champ.attack,
    health: champ.health,
    maxHealth: champ.health,
    movement: champ.movement,
    baseMovement: champ.movement,
    range: champ.range,
    abilities: champ.abilities.slice(),
    abilityUses: {},
    passive: champ.passive,
    // "alternate_movement" (ex: Sniper) : mobile a la creation/reapparition,
    // le passif bascule cet etat au debut de CHAQUE tour du proprietaire
    // (voir beginTurnSideEffects) -- jamais sur les tours des autres joueurs.
    canMoveThisTurn: true,
    q, r,
    hasMoved: false,
    hasAttacked: false,
    buffs: []
  };
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
    const championUnit = makeChampionUnit(player.championId, pid, player.side, start.q, start.r);
    state.units[championUnit.id] = championUnit;
    player.championUnitId = championUnit.id;

    player.maxMana = 1;
    player.mana = 1;
  }

  state.currentTurnIndex = 0;
  state.turnNumber = 1;
  state.turnStartedAt = Date.now();
  addLog(state, `La partie commence. Au tour de ${state.players[state.turnOrder[0]].name}.`);
}

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

function activePlayerId(state) {
  if (state.turnOrder.length === 0) return null;
  return state.turnOrder[state.currentTurnIndex % state.turnOrder.length];
}

function assertTurn(state, playerId) {
  if (state.status !== "playing") throw new Error("La partie n'est pas en cours.");
  if (activePlayerId(state) !== playerId) throw new Error("Ce n'est pas votre tour.");
}

function canAfford(state, player, cost) {
  return state.options.sandbox || player.mana >= cost;
}

function spendMana(state, player, cost) {
  if (state.options.sandbox) return;
  player.mana -= cost;
}

// Une case n'est occupee que par une unite VIVANTE (health > 0). C'est la
// seule source de verite pour "cette case est libre" : avant, un champ
// `koed` jamais mis a jour laissait les unites mortes bloquer leur case
// indefiniment (bug de deplacement). Desormais les unites non-Champion
// mortes sont retirees de state.units (voir pruneIfDead) et les Champions
// morts sont exclus via `health > 0`.
function isAlive(unit) {
  return !!unit && unit.health > 0;
}

/** Deplacement REELLEMENT utilisable par une unite CE tour, en tenant compte
 * de la boue (voir sort "Jet d'eau") : -1, minimum 1, applique dynamiquement
 * selon la case OU SE TROUVE ACTUELLEMENT l'unite (jamais stocke sur l'unite
 * elle-meme -- une unite qui quitte la boue redevient immediatement normale,
 * sans jamais depasser sa vraie limite de deplacement). */
function effectiveMovement(state, unit) {
  if (state.mudCells.has(hex.key(unit.q, unit.r))) {
    return Math.max(1, unit.movement - 1);
  }
  return unit.movement;
}

/** Une unite est invisible si elle porte le buff pose par la competence
 * Camouflage (voir game/abilities.js#applyAbilityEffect, cas "invisible").
 * Reutilise le systeme de buffs existant : expire tout seul via tickBuffs,
 * aucun etat supplementaire a gerer. */
function isInvisible(unit) {
  return !!(unit.buffs || []).some(b => b.type === "invisible");
}

/** Retire immediatement l'invisibilite (attaquer/agir contre un ennemi
 * revele l'unite) -- ne fait rien si elle n'etait pas invisible. */
function revealFromInvisibility(unit) {
  if (!unit.buffs || unit.buffs.length === 0) return;
  unit.buffs = unit.buffs.filter(b => b.type !== "invisible");
}

/** Regle de visibilite unique, utilisee a la fois pour serializeForPlayer
 * (units/units) et pour filtrer les evenements d'animation ("unitMoved") :
 * toujours visible pour son proprietaire, jamais pour un adversaire tant
 * qu'elle est invisible. L'unite reste evidemment presente dans l'etat
 * REEL (state.units) quoi qu'il arrive -- ceci ne filtre que ce qui est
 * ENVOYE a tel ou tel joueur. */
function isUnitVisibleTo(unit, viewerId) {
  if (!unit) return false;
  if (unit.ownerId === viewerId) return true;
  return !isInvisible(unit);
}

/** Declenche les pieges ENNEMIS presents sur les cases traversees (hors
 * case de depart, incluse dans `path`). Pas d'effet de declenchement
 * complexe pour l'instant : le piege est simplement consomme et revele
 * (log partage -- une fois declenche, il n'a plus de raison de rester
 * secret). Ne se declenche jamais sur son propre piege. */
function triggerTrapsAlongPath(state, unit, path) {
  const triggered = [];
  for (let i = 1; i < path.length; i++) {
    const cell = path[i];
    for (const trap of Object.values(state.traps)) {
      if (trap.ownerId === unit.ownerId) continue;
      if (trap.q !== cell.q || trap.r !== cell.r) continue;
      delete state.traps[trap.id];
      triggered.push({ trapId: trap.id, q: cell.q, r: cell.r });
      addLog(state, `${unit.name} declenche un piege !`);
    }
  }
  return triggered;
}

function occupiedSet(state, excludeUnitId) {
  const s = new Set();
  for (const u of Object.values(state.units)) {
    if (u.id === excludeUnitId) continue;
    if (!isAlive(u)) continue;
    s.add(hex.key(u.q, u.r));
  }
  return s;
}

function unitAt(state, q, r) {
  return Object.values(state.units).find(u => isAlive(u) && u.q === q && u.r === r) || null;
}

function ownsUnit(state, playerId, unit) {
  return !!unit && unit.ownerId === playerId && isAlive(unit);
}

/** Retire une unite morte non-Champion de state.units. Les Champions restent
 * (partie terminee ou ressuscites en bac a sable) mais ne comptent plus
 * jamais comme "occupant" une case grace a isAlive(). */
function pruneIfDead(state, unit) {
  if (unit && unit.health <= 0 && !unit.isChampion) {
    delete state.units[unit.id];
  }
}

function findFreeCellNear(state, cell) {
  if (!unitAt(state, cell.q, cell.r)) return cell;
  const board = state.boardConfig;
  const visited = new Set([hex.key(cell.q, cell.r)]);
  let frontier = [cell];
  while (frontier.length > 0) {
    const next = [];
    for (const c of frontier) {
      for (const n of board.neighbors(c.q, c.r)) {
        const k = hex.key(n.q, n.r);
        if (visited.has(k)) continue;
        visited.add(k);
        if (!unitAt(state, n.q, n.r)) return n;
        next.push(n);
      }
    }
    frontier = next;
  }
  return cell; // aucune case libre trouvee (plateau plein) : on retourne l'originale
}

function playCard(state, playerId, instanceId, q, r) {
  assertTurn(state, playerId);
  const player = state.players[playerId];
  const cardIndex = player.hand.findIndex(c => c.instanceId === instanceId);
  if (cardIndex === -1) throw new Error("Carte introuvable dans la main.");
  const card = cardsById[player.hand[cardIndex].cardId];
  if (!card) throw new Error("Cette carte est un sort, pas une unite.");

  if (!canAfford(state, player, card.cost)) throw new Error("Mana insuffisant.");
  const zone = state.boardConfig.deployZone(player.side);
  if (!zone.some(c => c.q === q && c.r === r)) throw new Error("Case de deploiement invalide.");
  if (unitAt(state, q, r)) throw new Error("Case deja occupee.");

  spendMana(state, player, card.cost);
  // Bac a sable : la carte n'est jamais retiree de la main (rejouable a l'infini,
  // aucune nouvelle carte n'est creee pour autant).
  if (!state.options.sandbox) player.hand.splice(cardIndex, 1);
  const unit = makeUnitFromCard(card.id, playerId, player.side, q, r);
  state.units[unit.id] = unit;
  addLog(state, `${player.name} invoque ${card.name}.`);
  return unit;
}

function moveUnit(state, playerId, unitId, q, r) {
  assertTurn(state, playerId);
  const unit = state.units[unitId];
  if (!ownsUnit(state, playerId, unit)) throw new Error("Unite invalide.");
  if (unit.hasMoved) throw new Error("Cette unite a deja bouge.");
  if (unitAt(state, q, r)) throw new Error("Case occupee.");

  const occ = occupiedSet(state, unitId);
  const path = shortestPath(state.boardConfig, unit.q, unit.r, q, r, effectiveMovement(state, unit), occ);
  if (!path) {
    throw new Error("Case hors de portee de deplacement.");
  }
  unit.q = q;
  unit.r = r;
  unit.hasMoved = true;

  const triggeredTraps = triggerTrapsAlongPath(state, unit, path);
  return { unit, path, triggeredTraps };
}

function getReachableForUnit(state, unitId) {
  const unit = state.units[unitId];
  if (!unit) return [];
  const occ = occupiedSet(state, unitId);
  return reachableCells(state.boardConfig, unit.q, unit.r, effectiveMovement(state, unit), occ);
}

/** Degats de zone (ex : Dynamiteur) : les unites a `splash.radius` de la
 * cible principale (alliees ou ennemies, hors attaquant et cible) recoivent
 * `splash.percent` des degats REELLEMENT infliges a la cible. Ne se propage
 * jamais en chaine (une seule passe, calculee une fois). */
function applySplashIfAny(state, attacker, target, damageDealt) {
  const card = cardsById[attacker.sourceId];
  const splash = card && card.splash;
  if (!splash) return [];

  const splashAmount = Math.max(1, Math.round(damageDealt * splash.percent));
  const nearby = Object.values(state.units).filter(u =>
    u.id !== target.id && u.id !== attacker.id && isAlive(u) &&
    hex.cubeDistance(u, target) <= splash.radius
  );

  const hits = [];
  for (const u of nearby) {
    u.health = Math.max(0, u.health - splashAmount);
    hits.push({ unit: u, damage: splashAmount });
  }
  if (hits.length > 0) {
    addLog(state, `${attacker.name} inflige des degats de zone (${splashAmount}) a ${hits.length} unite(s).`);
  }
  return hits;
}

/** Unites ennemies avec Provocation a portee de `attackerLike` (qui peut
 * etre une vraie unite, ou {ownerId, range, q, r} pour verifier une
 * position pas-encore-occupee, ex : Charge apres deplacement calcule mais
 * avant mutation). */
function tauntersInRange(state, attackerLike) {
  return Object.values(state.units).filter(u =>
    isAlive(u) && u.ownerId !== attackerLike.ownerId &&
    u.abilities && u.abilities.includes("provocation") &&
    hex.cubeDistance(attackerLike, u) <= attackerLike.range
  );
}

/** Provocation : si une unite ennemie provocatrice est a portee, la cible
 * choisie doit en faire partie. Ne force jamais l'attaque elle-meme --
 * uniquement invoque quand le joueur a deja decide d'attaquer. */
function assertValidAttackTarget(state, attackerLike, target) {
  const taunters = tauntersInRange(state, attackerLike);
  if (taunters.length > 0 && !taunters.some(u => u.id === target.id)) {
    throw new Error("Une unite avec Provocation est a portee : elle doit etre ciblee en priorite.");
  }
}

function attackUnit(state, playerId, attackerId, targetId) {
  assertTurn(state, playerId);
  const attacker = state.units[attackerId];
  const target = state.units[targetId];
  if (!ownsUnit(state, playerId, attacker)) throw new Error("Attaquant invalide.");
  if (!isAlive(target)) throw new Error("Cible invalide.");
  if (target.ownerId === playerId) throw new Error("Impossible d'attaquer sa propre unite.");
  if (attacker.hasAttacked) throw new Error("Cette unite a deja attaque.");
  if (!inRange(attacker, target)) throw new Error("Cible hors de portee.");
  assertValidAttackTarget(state, attacker, target);

  const result = resolveAttack(attacker, target);
  attacker.hasAttacked = true;
  revealFromInvisibility(attacker); // attaquer revele toujours l'attaquant
  addLog(state, `${attacker.name} attaque ${target.name} (${result.damage} degats).`);

  const splashHits = applySplashIfAny(state, attacker, target, result.damage);

  handlePotentialChampionDeath(state, target);
  pruneIfDead(state, target);
  for (const hit of splashHits) {
    handlePotentialChampionDeath(state, hit.unit);
    pruneIfDead(state, hit.unit);
  }

  // Riposte : une seule, jamais en chaine. La cible ne riposte que si
  // l'option est active, qu'elle a survecu et qu'elle peut reellement
  // atteindre l'attaquant avec SA propre portee.
  let retaliation = null;
  if (state.options.retaliate && isAlive(target) && isAlive(attacker) && canRetaliate(target, attacker)) {
    retaliation = resolveAttack(target, attacker);
    addLog(state, `${target.name} riposte contre ${attacker.name} (${retaliation.damage} degats).`);
    handlePotentialChampionDeath(state, attacker);
    pruneIfDead(state, attacker);
  }

  return {
    ...result,
    splash: splashHits.map(h => ({ unitId: h.unit.id, damage: h.damage })),
    retaliation
  };
}

/**
 * Charge : deplacement reel vers la cible puis attaque normale.
 * Validation COMPLETE (ligne de vue, chemin de deplacement atteignable,
 * Provocation) avant toute mutation -- si une regle bloque la charge,
 * l'unite ne doit ni avoir depense son mana, ni avoir bouge.
 */
function resolveCharge(state, player, caster, ability, target) {
  if (caster.hasMoved) throw new Error("Cette unite a deja bouge.");
  if (caster.hasAttacked) throw new Error("Cette unite a deja attaque.");

  // Ligne de vue : aucune unite (alliee ou ennemie) ne doit se trouver sur
  // le chemin direct entre l'attaquant et la cible (extremites exclues).
  const line = hex.hexLine(caster, target);
  for (let i = 1; i < line.length - 1; i++) {
    if (unitAt(state, line[i].q, line[i].r)) {
      throw new Error("Charge impossible : une unite bloque le chemin direct vers la cible.");
    }
  }

  // Position d'attaque : deja a portee -> pas de deplacement necessaire ;
  // sinon la case atteignable (via le deplacement NORMAL de l'unite, donc
  // sans jamais traverser une case occupee) la plus proche de la cible et
  // a portee d'attaque une fois arrivee.
  const occ = occupiedSet(state, caster.id);
  let destination = null;
  if (hex.cubeDistance(caster, target) <= ability.range) {
    destination = { q: caster.q, r: caster.r };
  } else {
    const candidates = reachableCells(state.boardConfig, caster.q, caster.r, effectiveMovement(state, caster), occ)
      .filter(c => hex.cubeDistance(c, target) <= ability.range)
      .sort((a, b) => hex.cubeDistance(a, target) - hex.cubeDistance(b, target));
    if (candidates.length > 0) destination = candidates[0];
  }
  if (!destination) {
    throw new Error("Charge impossible : aucun chemin valide vers la cible (hors de portee de deplacement).");
  }

  assertValidAttackTarget(state, { ownerId: caster.ownerId, range: ability.range, q: destination.q, r: destination.r }, target);

  // Chemin REEL vers la destination (pour l'animation cote client et pour
  // detecter les pieges traverses) -- calcule maintenant, avec les memes
  // parametres que la recherche ci-dessus, donc forcement valide.
  const path = shortestPath(state.boardConfig, caster.q, caster.r, destination.q, destination.r, effectiveMovement(state, caster), occ)
    || [{ q: caster.q, r: caster.r }];

  // Toutes les verifications sont passees : on peut muter (mana, position, attaque).
  spendMana(state, player, ability.cost);
  const moved = destination.q !== caster.q || destination.r !== caster.r;
  caster.q = destination.q;
  caster.r = destination.r;
  caster.hasMoved = true;

  const triggeredTraps = triggerTrapsAlongPath(state, caster, path);

  const result = resolveAttack(caster, target);
  caster.hasAttacked = true;
  revealFromInvisibility(caster); // charger revele toujours l'attaquant
  addLog(state, `${caster.name} charge ${target.name} (${result.damage} degats).`);

  const splashHits = applySplashIfAny(state, caster, target, result.damage);
  handlePotentialChampionDeath(state, target);
  pruneIfDead(state, target);
  for (const hit of splashHits) {
    handlePotentialChampionDeath(state, hit.unit);
    pruneIfDead(state, hit.unit);
  }

  let retaliation = null;
  if (state.options.retaliate && isAlive(target) && isAlive(caster) && canRetaliate(target, caster)) {
    retaliation = resolveAttack(target, caster);
    addLog(state, `${target.name} riposte contre ${caster.name} (${retaliation.damage} degats).`);
    handlePotentialChampionDeath(state, caster);
    pruneIfDead(state, caster);
  }

  return {
    ...result,
    moved,
    path,
    unitId: caster.id,
    triggeredTraps,
    splash: splashHits.map(h => ({ unitId: h.unit.id, damage: h.damage })),
    retaliation
  };
}

/**
 * Perforation : touche TOUTES les unites ennemies alignees sur la ligne de
 * tir entre l'attaquant et la cible (les allies sont epargnes mais ne
 * bloquent pas le tir). Chaque unite n'est touchee qu'une fois (la ligne
 * hexagonale ne visite jamais deux fois la meme case). Aucune propagation
 * en chaine : une seule passe sur la ligne calculee au depart.
 */
function resolvePerforation(state, caster, target, ability) {
  const line = hex.hexLine(caster, target);
  const hits = [];
  for (const cell of line) {
    if (cell.q === caster.q && cell.r === caster.r) continue; // case de depart
    const unit = unitAt(state, cell.q, cell.r);
    if (!unit) continue;
    if (unit.ownerId === caster.ownerId) continue; // allies epargnes
    const damage = Math.max(1, ability.effect.amount - effectiveDefense(unit));
    unit.health = Math.max(0, unit.health - damage);
    hits.push({ unit, damage });
  }
  return hits;
}

function useAbility(state, playerId, casterId, abilityId, targetId) {
  assertTurn(state, playerId);
  const caster = state.units[casterId];
  if (!ownsUnit(state, playerId, caster)) throw new Error("Unite invalide.");
  if (!caster.abilities.includes(abilityId)) throw new Error("Competence inconnue pour cette unite.");
  const ability = abilitiesById[abilityId];
  if (!ability) throw new Error("Competence introuvable.");
  if (ability.passive) throw new Error("Cette competence est passive : elle ne peut pas etre activee directement.");

  const player = state.players[playerId];
  if (!canAfford(state, player, ability.cost)) throw new Error("Mana insuffisant.");
  if (!usage.canUse(caster.abilityUses, abilityId, ability.uses)) {
    throw new Error("Nombre d'utilisations maximum atteint pour cette competence.");
  }

  // La Charge se resout entierement a part : deplacement reel + attaque
  // normale, avec sa propre notion de "portee" (deplacement + portee
  // d'attaque combines), verifiee dans resolveCharge.
  if (ability.isCharge) {
    const target = state.units[targetId];
    if (!isAlive(target)) throw new Error("Cible invalide.");
    if (target.ownerId === playerId) throw new Error("Cible ennemie requise.");
    const result = resolveCharge(state, player, caster, ability, target);
    usage.recordUse(caster.abilityUses, abilityId);
    addLog(state, `${caster.name} utilise ${ability.name}.`);
    return result;
  }

  let target = caster;
  if (ability.targetType !== "self") {
    target = state.units[targetId];
    if (!isAlive(target)) throw new Error("Cible invalide.");
    if (ability.targetType === "ally" && target.ownerId !== playerId) throw new Error("Cible alliee requise.");
    if (ability.targetType === "enemy" && target.ownerId === playerId) throw new Error("Cible ennemie requise.");
    if (!inAbilityRange(caster, target, ability.range)) throw new Error("Cible hors de portee.");
    if (ability.targetType === "enemy") assertValidAttackTarget(state, caster, target);
  }

  spendMana(state, player, ability.cost);
  usage.recordUse(caster.abilityUses, abilityId);
  if (ability.targetType === "enemy") revealFromInvisibility(caster); // agir contre un ennemi revele toujours l'unite

  if (ability.isPiercing) {
    const hits = resolvePerforation(state, caster, target, ability);
    addLog(state, `${caster.name} utilise ${ability.name} (${hits.length} unite(s) touchee(s)).`);
    for (const hit of hits) {
      handlePotentialChampionDeath(state, hit.unit);
      pruneIfDead(state, hit.unit);
    }
    return { type: "piercing", hits: hits.map(h => ({ unitId: h.unit.id, damage: h.damage })) };
  }

  const result = applyAbilityEffect(ability, caster, target);
  addLog(state, `${caster.name} utilise ${ability.name}.`);

  handlePotentialChampionDeath(state, target);
  pruneIfDead(state, target);
  return result;
}

function castSpell(state, playerId, instanceId, targetId, targetCell) {
  assertTurn(state, playerId);
  const player = state.players[playerId];
  const handIndex = player.hand.findIndex(c => c.instanceId === instanceId);
  if (handIndex === -1) throw new Error("Sort introuvable dans la main.");
  const cardId = player.hand[handIndex].cardId;
  const spell = spellsById[cardId];
  if (!spell) throw new Error("Cette carte n'est pas un sort.");
  if (!canAfford(state, player, spell.cost)) throw new Error("Mana insuffisant.");
  if (!usage.canUse(player.cardUses, cardId, spell.uses)) {
    throw new Error("Nombre d'utilisations maximum atteint pour ce sort.");
  }

  let target = null;
  let cell = null;
  if (spell.targetType === "ally" || spell.targetType === "enemy") {
    target = state.units[targetId];
    if (!isAlive(target)) throw new Error("Cible invalide.");
    if (spell.targetType === "ally" && target.ownerId !== playerId) throw new Error("Cible alliee requise.");
    if (spell.targetType === "enemy" && target.ownerId === playerId) throw new Error("Cible ennemie requise.");
  } else if (spell.targetType === "cell") {
    if (!targetCell || !state.boardConfig.inBounds(targetCell.q, targetCell.r)) {
      throw new Error("Case cible invalide.");
    }
    cell = { q: targetCell.q, r: targetCell.r };
  }

  // Le mana et la carte ne sont consommes qu'une fois la cible validee :
  // une selection annulee cote client (aucun evenement envoye) ne coute rien.
  spendMana(state, player, spell.cost);
  usage.recordUse(player.cardUses, cardId);
  const [handCard] = player.hand.splice(handIndex, 1);
  if (state.options.sandbox) {
    // Bac a sable : la carte retourne aussitot en main (rejouable a l'infini).
    player.hand.push(handCard);
  } else {
    player.graveyard.push(handCard); // defausse, reutilisable via l'option "reshuffleDiscard"
  }

  const effect = spell.effect;
  let result;
  if (effect.type === "damage") {
    result = spells.applyDamage(target, effect.amount);
    handlePotentialChampionDeath(state, target);
    pruneIfDead(state, target);
  } else if (effect.type === "heal") {
    result = spells.applyHeal(target, effect.amount);
  } else if (effect.type === "draw") {
    for (let i = 0; i < effect.amount; i++) drawCard(state, playerId);
    result = { type: "draw", amount: effect.amount };
  } else if (effect.type === "mud") {
    // Pas de cumul : un Set ne stocke chaque case qu'une fois, cibler une
    // case deja boueuse est donc sans risque (juste sans effet supplementaire).
    state.mudCells.add(hex.key(cell.q, cell.r));
    result = { type: "mud", q: cell.q, r: cell.r };
  } else if (effect.type === "trap") {
    // Stocke uniquement dans l'etat SERVEUR : serializeForPlayer ne renvoie
    // ce piege qu'a son proprietaire (voir plus bas), jamais a l'adversaire.
    // Le log partage mentionne bien qu'un piege a ete pose (comme pour tout
    // sort), mais JAMAIS sa position -- seul son declenchement la revelera.
    const trap = { id: uid("trap"), ownerId: playerId, q: cell.q, r: cell.r };
    state.traps[trap.id] = trap;
    result = { type: "trap", q: cell.q, r: cell.r };
  } else {
    throw new Error(`Type d'effet de sort inconnu: ${effect.type}`);
  }

  addLog(state, `${player.name} lance ${spell.name}.`);
  return result;
}

function endGame(state, winnerId) {
  state.status = "finished";
  state.winnerId = winnerId;
  state.turnStartedAt = null;
  if (winnerId) addLog(state, `${state.players[winnerId].name} remporte la partie !`);
  else addLog(state, "Partie terminee.");
}

/** Gere la mort d'un Champion : resurrection immediate en bac a sable,
 * elimination du joueur sinon (2 joueurs -> l'autre gagne immediatement ;
 * 4 joueurs -> la partie continue entre les survivants). */
function handlePotentialChampionDeath(state, unit) {
  if (!unit || !unit.isChampion || unit.health > 0) return;
  const owner = state.players[unit.ownerId];

  if (state.options.sandbox) {
    const start = state.boardConfig.championStart(owner.side);
    const cell = findFreeCellNear(state, start);
    unit.health = unit.maxHealth;
    unit.q = cell.q;
    unit.r = cell.r;
    unit.buffs = [];
    // Etat de deplacement alterne (ex: Sniper) remis a "mobile" de facon
    // coherente a la reapparition, plutot que de rester bloque sur l'etat
    // qu'il avait au moment de sa mort.
    if (unit.passive && unit.passive.type === "alternate_movement") {
      unit.canMoveThisTurn = true;
      unit.movement = unit.baseMovement;
    }
    addLog(state, `${unit.name} ressuscite instantanement (mode bac a sable).`);
    return;
  }

  eliminatePlayer(state, unit.ownerId);
}

function eliminatePlayer(state, playerId) {
  const player = state.players[playerId];
  if (!player || player.eliminated || state.status !== "playing") return;

  // BUG "le nouveau joueur actif ne peut plus agir" : quand le joueur
  // elimine avait la main (ex. son propre Champion meurt d'un degat de
  // zone pendant SON tour), le tour retombe silencieusement sur le suivant
  // -- mais celui-ci n'a alors jamais recu son VRAI debut de tour (mana
  // rempli, pioche, remise a zero deplacement/attaque, compteurs
  // d'utilisation). Il "a la main" sans pouvoir rien faire : mana bloque a
  // l'ancienne valeur, unites encore marquees hasMoved/hasAttacked. Il faut
  // detecter ce cas et lui appliquer les effets de debut de tour comme le
  // ferait un endTurn() normal.
  const wasActive = activePlayerId(state) === playerId;

  player.eliminated = true;
  addLog(state, `${player.name} est elimine de la partie.`);

  const idx = state.turnOrder.indexOf(playerId);
  if (idx !== -1) {
    if (idx < state.currentTurnIndex) state.currentTurnIndex -= 1;
    state.turnOrder.splice(idx, 1);
    if (state.turnOrder.length > 0) {
      state.currentTurnIndex = ((state.currentTurnIndex % state.turnOrder.length) + state.turnOrder.length) % state.turnOrder.length;
    }
  }

  const remaining = state.turnOrder.filter(id => !state.players[id].eliminated);
  if (remaining.length <= 1) {
    endGame(state, remaining[0] || null);
    return;
  }

  if (wasActive) {
    if (state.currentTurnIndex === 0) state.turnNumber += 1;
    state.turnStartedAt = Date.now();
    const nextId = activePlayerId(state);
    beginTurnSideEffects(state, nextId);
    addLog(state, `Au tour de ${state.players[nextId].name}.`);
  }
  // Si le joueur elimine n'avait PAS la main, le tour du joueur actif
  // actuel continue normalement : ne pas toucher turnStartedAt (ca
  // prolongerait injustement son chronometre) ni ses effets de tour.
}

function forfeit(state, playerId) {
  if (state.status !== "playing") throw new Error("Aucune partie en cours.");
  const player = state.players[playerId];
  if (!player || player.eliminated) throw new Error("Vous n'etes plus dans cette partie.");
  addLog(state, `${player.name} abandonne la partie.`);
  eliminatePlayer(state, playerId);
}

function beginTurnSideEffects(state, playerId) {
  const player = state.players[playerId];
  player.maxMana = Math.min(MAX_MANA, player.maxMana + 1);
  player.mana = player.maxMana;
  drawCard(state, playerId);
  usage.resetTurnCounters(player.cardUses);

  for (const u of Object.values(state.units)) {
    if (u.ownerId !== playerId) continue;
    tickBuffs(u);
    usage.resetTurnCounters(u.abilityUses);
  }

  const championUnit = state.units[player.championUnitId];
  if (championUnit && isAlive(championUnit) && championUnit.passive) {
    if (championUnit.passive.type === "regen") {
      championUnit.health = Math.min(championUnit.maxHealth, championUnit.health + championUnit.passive.amount);
    }
    if (championUnit.passive.type === "alternate_movement") {
      // Un tour sur deux, base UNIQUEMENT sur les tours de ce proprietaire
      // (cette fonction n'est appelee qu'au debut de SES tours, jamais pour
      // les tours des autres joueurs) : n'affecte que le deplacement,
      // jamais l'attaque ni les competences.
      championUnit.canMoveThisTurn = !championUnit.canMoveThisTurn;
      championUnit.movement = championUnit.canMoveThisTurn ? championUnit.baseMovement : 0;
    }
  }
}

function endTurn(state, playerId) {
  assertTurn(state, playerId);

  for (const u of Object.values(state.units)) {
    if (u.ownerId === playerId) {
      u.hasMoved = false;
      u.hasAttacked = false;
      if (u.bonusMovementThisTurn) {
        u.movement -= u.bonusMovementThisTurn;
        u.bonusMovementThisTurn = 0;
      }
    }
  }

  state.currentTurnIndex = (state.currentTurnIndex + 1) % state.turnOrder.length;
  if (state.currentTurnIndex === 0) state.turnNumber += 1;
  state.turnStartedAt = Date.now();

  const nextId = activePlayerId(state);
  beginTurnSideEffects(state, nextId);

  addLog(state, `Au tour de ${state.players[nextId].name}.`);
}

/** Deconnexion. Salon d'attente : la place est reellement liberee (evite le
 * bug "partie complete" apres un depart avant lancement). Partie en cours :
 * traite comme un abandon (comportement precedent conserve). */
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

function turnRemainingSeconds(state) {
  const secs = state.options.turnTimerSeconds;
  if (!secs || !state.turnStartedAt || state.status !== "playing") return null;
  const elapsed = (Date.now() - state.turnStartedAt) / 1000;
  return Math.max(0, Math.round(secs - elapsed));
}

function serializeForPlayer(state, viewerId) {
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
      handCount: p.hand.length,
      deckCount: p.deck.length,
      graveyardCount: p.graveyard.length,
      hand: id === viewerId ? p.hand : undefined,
      connected: p.connected,
      ready: p.ready,
      eliminated: p.eliminated
    };
  }
  // Copie superficielle par unite (jamais de mutation de state.units) pour y
  // ajouter le deplacement REEL de ce tour (boue comprise) : le client
  // n'a ainsi jamais a reimplementer la regle de la boue pour l'affichage.
  // Filtrage d'INVISIBILITE ICI, cote serveur : une unite adverse invisible
  // n'est PAS juste masquee visuellement, elle est totalement absente du
  // JSON envoye a ce joueur (voir isUnitVisibleTo) -- elle reste bien sur
  // presente dans state.units (l'etat reel), qui seul fait foi pour les
  // regles (occupation, cibles, etc.).
  const units = {};
  for (const [id, u] of Object.entries(state.units)) {
    if (!isUnitVisibleTo(u, viewerId)) continue;
    units[id] = {
      ...u,
      effectiveMovement: effectiveMovement(state, u),
      invisible: u.ownerId === viewerId ? isInvisible(u) : undefined
    };
  }

  // Pieges : jamais envoyes a un adversaire, meme leur existence (voir
  // castSpell, effect "trap") -- seul le proprietaire recoit ses propres
  // cases piegees.
  const traps = Object.values(state.traps)
    .filter(t => t.ownerId === viewerId)
    .map(t => ({ id: t.id, q: t.q, r: t.r }));

  return {
    code: state.code,
    status: state.status,
    maxPlayers: state.maxPlayers,
    options: state.options,
    players,
    order: state.order,
    turnOrder: state.turnOrder,
    activePlayerId: state.status === "playing" ? activePlayerId(state) : null,
    turnNumber: state.turnNumber,
    turnRemainingSeconds: turnRemainingSeconds(state),
    units,
    mudCells: Array.from(state.mudCells),
    traps,
    board: { cols: state.boardConfig.cols, rows: state.boardConfig.rows, seats: state.boardConfig.seats },
    winnerId: state.winnerId,
    log: state.log.slice(-15),
    you: viewerId
  };
}

module.exports = {
  MIN_DECK_SIZE,
  DEFAULT_OPTIONS,
  createGame,
  joinGame,
  setPlayerLoadout,
  allPlayersReady,
  startGame,
  playCard,
  moveUnit,
  attackUnit,
  useAbility,
  castSpell,
  endTurn,
  forfeit,
  removePlayer,
  serializeForPlayer,
  getReachableForUnit,
  activePlayerId,
  isUnitVisibleTo
};
