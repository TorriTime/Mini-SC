// Note d'une position du point de vue d'un joueur IA : plus elle est haute,
// mieux il se porte. L'IA choisit l'action qui mene a la meilleure note.
//
// La note additionne : la valeur des unites (les siennes moins celles des
// adversaires), les mines dominees, le placement (ouvriers vers les mines,
// combattants vers l'ennemi), le mana et les cartes gardes, puis -- selon le
// niveau -- les attaques encore possibles ce tour et le danger couru au
// prochain tour adverse.

const hex = require("../hexGrid");
const { isAlive, isInvisible } = require("../units");
const { effectiveMovement } = require("../battlefield");
const { effectiveAttack, effectiveDefense } = require("../combat");
const { mineOwnerId, isMineSafe, towerOfMine } = require("../mines");
const { manaCap } = require("../mana");

const WIN = 1e6;

const DEFAULT_WEIGHTS = {
  championHealth: 3,   // par PV de Champion : le perdre, c'est perdre la partie
  ownChampionBonus: 0, // supplement par PV de MON Champion (jeu plus defensif)
  unitBase: 12,        // une unite sur le plateau vaut deja par sa presence
  unitAttack: 0.8,
  unitHealth: 0.5,
  towerBase: 40,
  mine: 45,            // mine neutre dominee (via une tour)
  unsafeMine: 5,
  skippedQuarter: 8,   // deploiement avance : quart de mana perdu
  settlingWorker: 30,  // ouvrier installe au centre d'une mine : future tour
  workerStep: 2.5,     // par case separant un ouvrier d'une mine libre
  approachFoe: 1.2,    // par case separant un combattant de l'ennemi le plus proche
  approachChampion: 0.8,
  auraAlly: 1.5,       // par allie protege par une aura
  mana: 1.5,
  card: 3,
  mudUnderFoe: 5,
  buffAttack: 0.4,
  buffDefense: 0.4,
  invisible: 8
};

/** Valeur "materielle" d'une unite, quel que soit son camp. */
function unitValue(W, unit) {
  if (unit.isChampion) return W.championHealth * unit.health;
  if (unit.isTower) return W.towerBase + W.unitHealth * unit.health;
  return W.unitBase + W.unitAttack * unit.attack + W.unitHealth * unit.health;
}

/** Valeur perdue par `unit` si elle subit `damage`. */
function damageValue(W, unit, damage) {
  const dealt = Math.min(damage, unit.health);
  if (unit.isChampion) return W.championHealth * dealt;
  const killed = dealt >= unit.health;
  return W.unitHealth * dealt + (killed ? unitValue(W, { ...unit, health: 0 }) : 0);
}

const distance = (a, b) => hex.cubeDistance(a, b);
const nearest = (from, targets) => targets.reduce((best, t) => Math.min(best, distance(from, t)), Infinity);
const isFighter = unit => !unit.isTower && !unit.isWorker && unit.attack > 0;

/** Meilleur gain net d'une attaque normale que `unit` peut encore faire ce
 * tour depuis sa case (riposte deduite), ou 0. */
function attackPotential(W, state, unit, foes) {
  if (unit.hasAttacked || unit.attack <= 0) return 0;
  let best = 0;
  for (const foe of foes) {
    const dist = distance(unit, foe);
    if (dist > unit.range || dist === 0) continue;
    const damage = Math.max(1, effectiveAttack(unit) - effectiveDefense(foe));
    let gain = damageValue(W, foe, damage);
    const foeSurvives = damage < foe.health;
    if (state.options.retaliate && foeSurvives && foe.range >= dist && foe.attack > 0) {
      gain -= damageValue(W, unit, Math.max(1, effectiveAttack(foe) - effectiveDefense(unit)));
    }
    best = Math.max(best, gain);
  }
  return best;
}

/** Valeur que `unit` risque de perdre au prochain tour adverse : degats des
 * ennemis capables de venir l'attaquer (deplacement + portee). */
function threatOn(W, state, unit, foes) {
  if (isInvisible(unit)) return 0;
  let incoming = 0;
  for (const foe of foes) {
    if (foe.attack <= 0) continue;
    if (distance(unit, foe) <= effectiveMovement(state, foe) + foe.range) {
      incoming += Math.max(1, effectiveAttack(foe) - effectiveDefense(unit));
    }
  }
  return incoming > 0 ? damageValue(W, unit, incoming) : 0;
}

function buffsValue(W, unit, foeNearby) {
  let value = 0;
  for (const buff of unit.buffs || []) {
    if (!foeNearby) continue;
    if (buff.type === "attack") value += W.buffAttack * buff.amount;
    if (buff.type === "defense") value += W.buffDefense * buff.amount;
    if (buff.type === "invisible") value += W.invisible;
  }
  return value;
}

/**
 * Note de `state` pour le joueur `botId`. `level` : reglages du niveau de
 * difficulte (voir levels.js).
 */
function evaluate(state, botId, level) {
  const W = level.weights ? { ...DEFAULT_WEIGHTS, ...level.weights } : DEFAULT_WEIGHTS;
  const me = state.players[botId];
  if (state.status === "finished") return state.winnerId === botId ? WIN : -WIN;
  if (!me || me.eliminated) return -WIN;

  const living = Object.values(state.units).filter(isAlive);
  const mine = living.filter(u => u.ownerId === botId);
  // Les unites d'un joueur elimine restent sur le plateau mais ne comptent plus.
  const foes = living.filter(u => u.ownerId !== botId && !state.players[u.ownerId].eliminated);
  const foeChampions = foes.filter(u => u.isChampion);
  const myTurn = state.turnOrder[state.currentTurnIndex % state.turnOrder.length] === botId;

  let score = 0;
  for (const unit of mine) score += unitValue(W, unit) + (unit.isChampion ? W.ownChampionBonus * unit.health : 0);
  for (const unit of foes) score -= unitValue(W, unit);

  // ---- Mines ----
  const freeMines = [];
  for (const m of state.mines) {
    if (m.homeOwnerId) continue;
    const owner = mineOwnerId(state, m);
    if (owner === botId) {
      score += W.mine;
      if (!isMineSafe(state, m)) score -= W.unsafeMine;
      const tower = towerOfMine(state, m);
      if (tower && tower.skipQuarter) score -= W.skippedQuarter;
    } else if (owner && !state.players[owner].eliminated) {
      score -= W.mine;
    } else if (!owner && !mine.some(u => u.settlingMineId === m.id)) {
      freeMines.push(m);
    }
  }

  // ---- Placement et etat de mes unites ----
  for (const unit of mine) {
    const foeDistance = nearest(unit, foes);
    score += buffsValue(W, unit, foeDistance <= 5);

    if (unit.isWorker) {
      if (unit.settlingMineId) score += W.settlingWorker;
      else if (freeMines.length > 0) score -= W.workerStep * nearest(unit, freeMines);
    } else if (isFighter(unit) && foes.length > 0) {
      // Le Champion avance moins volontiers que les troupes.
      const eagerness = unit.isChampion ? 0.4 : 1;
      score -= eagerness * W.approachFoe * foeDistance;
      if (foeChampions.length > 0) score -= eagerness * W.approachChampion * nearest(unit, foeChampions);
    }
    if (unit.aura) {
      score += W.auraAlly * mine.filter(u => u !== unit && distance(u, unit) <= unit.aura.radius).length;
    }

    if (level.potential > 0 && myTurn) score += level.potential * Math.max(0, attackPotential(W, state, unit, foes));
    if (level.threat > 0) {
      // Un Champion deja affaibli devient deux fois plus prudent.
      const caution = unit.isChampion && unit.health <= unit.maxHealth * 0.4 ? 2 : 1;
      score -= caution * level.threat * threatOn(W, state, unit, foes);
    }
  }

  for (const foe of foes) {
    if (foe.movement > 1 && state.mudCells.has(hex.key(foe.q, foe.r))) score += W.mudUnderFoe;
  }

  // ---- Ressources gardees pour plus tard ----
  if (!state.options.sandbox) score += W.mana * Math.min(me.mana, manaCap(me));
  score += W.card * me.hand.length;

  return score;
}

module.exports = { evaluate, WIN };
