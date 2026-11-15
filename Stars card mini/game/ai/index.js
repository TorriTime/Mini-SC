// Intelligence artificielle : joue le tour d'un joueur action par action.
//
// Principe : a chaque etape, l'IA essaie chacune des actions possibles sur
// une COPIE de la partie (avec le vrai moteur de jeu, donc avec les vraies
// regles), note la position obtenue (evaluate.js) et garde la meilleure. Si
// aucune action ne fait mieux que "ne rien faire de plus", elle termine son
// tour. Le niveau de difficulte (levels.js) regle sa precision et sa prudence.
// Le niveau le plus fort va plus loin : il prepare plusieurs plans pour son
// tour entier et garde celui qui resiste le mieux a la riposte adverse
// (voir planTurn).
//
// L'IA n'utilise que ce qu'un joueur humain verrait (view.js) et passe par
// les memes actions que lui : elle ne peut ni tricher ni contourner une regle.

const { activePlayerId, endTurn } = require("../turns");
const { playCard } = require("../actions/deploy");
const { moveUnit } = require("../actions/move");
const { attackUnit } = require("../actions/attack");
const { useAbility } = require("../actions/ability");
const { castSpell } = require("../actions/spell");
const { spellsById } = require("../catalog");
const { LEVELS, isLevel } = require("./levels");
const { cloneState, botView } = require("./view");
const { evaluate } = require("./evaluate");
const { listActions } = require("./candidates");

const END_TURN = { type: "endTurn" };

const RUNNERS = {
  playCard: (state, id, a) => playCard(state, id, a.instanceId, a.q, a.r),
  moveUnit: (state, id, a) => moveUnit(state, id, a.unitId, a.q, a.r),
  attackUnit: (state, id, a) => attackUnit(state, id, a.attackerId, a.targetId),
  useAbility: (state, id, a) => useAbility(state, id, a.casterId, a.abilityId, a.targetId),
  castSpell: (state, id, a) => castSpell(state, id, a.instanceId, a.targetId, a.targetCell),
  endTurn: (state, id) => endTurn(state, id)
};

/** Execute `action` pour `playerId` sur `state` (reel ou copie). Leve une
 * erreur si le moteur la refuse. Retourne le resultat du moteur. */
function applyAction(state, playerId, action) {
  return RUNNERS[action.type](state, playerId, action);
}

/** Identifiant stable d'une action (pour ne pas retenter une action refusee). */
const actionKey = ({ simUnitId, ...action }) => JSON.stringify(action);

/** Note de la position apres `action`, ou null si le moteur la refuse. */
function scoreAfter(view, botId, action, level) {
  const sim = cloneState(view);
  let result;
  try {
    result = applyAction(sim, botId, action);
  } catch (e) {
    return null;
  }
  let score = evaluate(sim, botId, level);

  // Prevoir l'attaque qui suit : une unite qui vient d'arriver sur une case
  // (deplacement ou deploiement) vaut aussi par ce qu'elle peut y frapper.
  if (level.lookahead && sim.status === "playing" && (action.type === "moveUnit" || action.type === "playCard")) {
    const unit = action.type === "moveUnit" ? sim.units[action.unitId] : result;
    if (unit && !unit.hasAttacked && unit.attack > 0) {
      for (const follow of listActions(sim, botId)) {
        if (follow.type !== "attackUnit" || follow.attackerId !== unit.id) continue;
        const next = cloneState(sim);
        try { applyAction(next, botId, follow); } catch (e) { continue; }
        score = Math.max(score, evaluate(next, botId, level));
      }
    }
  }
  return score;
}

/** Meilleure action immediate pour `botId` dans `view` (dont c'est le tour),
 * ou END_TURN si aucune ne fait mieux que de ne rien faire de plus. */
function bestAction(view, botId, level, refused) {
  const noise = () => (level.noise > 0 ? (Math.random() - 0.5) * 2 * level.noise : 0);
  let bestScore = evaluate(view, botId, level) + noise(); // la note a battre
  let best = END_TURN;

  for (const action of listActions(view, botId)) {
    if (refused && refused.has(actionKey(action))) continue;
    if (level.blunder > 0 && Math.random() < level.blunder) continue;
    const score = scoreAfter(view, botId, action, level);
    if (score === null) continue;
    const noisy = score + noise();
    if (noisy > bestScore + 1e-6) {
      bestScore = noisy;
      best = action;
    }
  }
  return best;
}

/** Joue dans `sim` (une copie) tout le tour de `playerId`, action par action,
 * puis le termine. Retourne les actions jouees, fin de tour comprise. */
function playOutTurn(sim, playerId, level, refused, alreadyPlayed = 0) {
  const played = [];
  const isMyTurn = () => sim.status === "playing" && activePlayerId(sim) === playerId;
  while (isMyTurn() && alreadyPlayed + played.length < level.maxActions) {
    const action = bestAction(sim, playerId, level, refused);
    if (action === END_TURN) break;
    const result = applyAction(sim, playerId, action);
    // L'unite deployee dans la simulation n'aura pas le meme identifiant dans
    // la vraie partie : on le note pour corriger la suite du plan (noteResult).
    played.push(action.type === "playCard" ? { ...action, simUnitId: result.id } : action);
  }
  if (isMyTurn()) applyAction(sim, playerId, END_TURN);
  played.push(END_TURN);
  return played;
}

const isDrawSpell = (state, botId, action) => {
  if (action.type !== "castSpell") return false;
  const inHand = state.players[botId].hand.find(c => c.instanceId === action.instanceId);
  const spell = inHand && spellsById[inHand.cardId];
  return !!spell && spell.effect.type === "draw";
};

/**
 * Prepare le tour entier de `botId` (niveaux a anticipation, voir
 * level.plans) : un plan par "style" de jeu, chacun joue jusqu'au bout sur
 * une copie ; puis chaque adversaire y repond de son mieux, et l'on garde le
 * plan qui laisse la meilleure position APRES la riposte adverse.
 */
function planTurn(view, botId, level, memory) {
  let best = null;
  for (const style of level.plans) {
    const styled = { ...level, ...style, weights: { ...level.weights, ...style.weights } };
    const sim = cloneState(view);
    const actions = playOutTurn(sim, botId, styled, memory.refused, memory.actions);

    // Riposte de chaque adversaire, jusqu'a ce que la main me revienne.
    for (let guard = 0; guard < sim.maxPlayers && sim.status === "playing" && activePlayerId(sim) !== botId; guard++) {
      playOutTurn(sim, activePlayerId(sim), level.reply, null);
    }
    // Puis mon tour suivant : un plan qui prepare un coup decisif est juge
    // sur ce coup, pas seulement sur la position intermediaire.
    if (level.followUp && sim.status === "playing" && activePlayerId(sim) === botId) {
      playOutTurn(sim, botId, level.reply, null);
    }
    const score = evaluate(sim, botId, level);
    if (!best || score > best.score) best = { score, actions };
  }

  // Une pioche revele des cartes que l'IA ne connait pas encore : le plan
  // s'arrete la, la suite sera preparee avec la vraie main.
  const drawAt = best.actions.findIndex(action => isDrawSpell(view, botId, action));
  return drawAt === -1 ? best.actions : best.actions.slice(0, drawAt + 1);
}

/**
 * Prochaine action du joueur IA `botId` (dont c'est le tour), ou
 * { type: "endTurn" } s'il n'a plus rien d'utile a faire.
 *   levelName : "easy" | "normal" | "hard"
 *   memory    : memoire du tour en cours, a creer avec newTurnMemory() au
 *               debut de chaque tour et a tenir a jour avec noteResult().
 */
function chooseAction(state, botId, levelName, memory = newTurnMemory()) {
  const level = LEVELS[isLevel(levelName) ? levelName : "normal"];
  if (state.status !== "playing" || activePlayerId(state) !== botId) return END_TURN;
  if (memory.actions >= level.maxActions) return END_TURN;
  if (level.stopChance > 0 && Math.random() < level.stopChance) return END_TURN;

  const view = botView(state, botId);
  if (!level.plans) return bestAction(view, botId, level, memory.refused);

  if (!memory.plan || memory.plan.length === 0) memory.plan = planTurn(view, botId, level, memory);
  return memory.plan.shift();
}

/** Memoire d'un tour d'IA : nombre d'actions jouees, actions refusees par le
 * moteur (a ne pas retenter) et plan en cours (niveaux a anticipation). */
function newTurnMemory() {
  return { actions: 0, refused: new Set(), plan: null };
}

/** A appeler apres avoir tente `action` sur la vraie partie. Un refus
 * (ex : case occupee par une unite invisible) invalide le plan en cours. */
function noteResult(memory, action, accepted, result) {
  if (!accepted) {
    memory.refused.add(actionKey(action));
    memory.plan = null;
    return;
  }
  memory.actions++;
  if (action.simUnitId && memory.plan && result && result.id) {
    const realId = id => (id === action.simUnitId ? result.id : id);
    memory.plan = memory.plan.map(next => {
      const fixed = { ...next };
      for (const field of ["unitId", "attackerId", "casterId", "targetId"]) {
        if (field in fixed) fixed[field] = realId(fixed[field]);
      }
      return fixed;
    });
  }
}

module.exports = { chooseAction, applyAction, newTurnMemory, noteResult, LEVELS, isLevel };
