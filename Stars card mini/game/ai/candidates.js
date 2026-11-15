// Liste des actions qu'un joueur IA peut tenter pendant son tour. Chaque
// action est un objet simple { type, ... } (voir index.js#applyAction).
// La liste est volontairement large : c'est le moteur de jeu, en simulation,
// qui ecarte celles qui sont interdites.

const hex = require("../hexGrid");
const { cardsById, spellsById, abilitiesById } = require("../catalog");
const { isAlive } = require("../units");
const { unitAt, effectiveMovement, getReachableForUnit } = require("../battlefield");
const { ownTowersAdjacentTo, towerOfMine } = require("../mines");
const usage = require("../usage");

function deployCells(state, player) {
  const cells = state.boardConfig.deployZone(player.side);
  const seen = new Set(cells.map(c => hex.key(c.q, c.r)));
  for (const unit of Object.values(state.units)) {
    if (!unit.isTower || unit.ownerId !== player.id || !isAlive(unit)) continue;
    for (const n of state.boardConfig.neighbors(unit.q, unit.r)) {
      if (!seen.has(hex.key(n.q, n.r)) && ownTowersAdjacentTo(state, player.id, n.q, n.r).length > 0) {
        seen.add(hex.key(n.q, n.r));
        cells.push(n);
      }
    }
  }
  return cells.filter(c => !unitAt(state, c.q, c.r));
}

const MAX_DEPLOY_CELLS = 6;

/** Les quelques cases de deploiement qui valent d'etre essayees pour une
 * carte : les plus proches de son objectif (mine libre pour un Ouvrier,
 * ennemi le plus proche sinon), plus les 2 plus proches de mon Champion. */
function bestDeployCells(cells, card, context) {
  if (cells.length <= MAX_DEPLOY_CELLS) return cells;
  const goals = card.isWorker && context.freeMines.length > 0 ? context.freeMines : context.foes;
  const toGoal = c => goals.reduce((best, g) => Math.min(best, hex.cubeDistance(c, g)), Infinity);
  const byGoal = cells.slice().sort((a, b) => toGoal(a) - toGoal(b)).slice(0, MAX_DEPLOY_CELLS - 2);
  const rest = cells.filter(c => !byGoal.includes(c));
  const guard = context.champion
    ? rest.sort((a, b) => hex.cubeDistance(a, context.champion) - hex.cubeDistance(b, context.champion)).slice(0, 2)
    : [];
  return byGoal.concat(guard);
}

function listActions(state, botId) {
  const player = state.players[botId];
  const sandbox = state.options.sandbox;
  const living = Object.values(state.units).filter(isAlive);
  const mine = living.filter(u => u.ownerId === botId);
  const others = living.filter(u => u.ownerId !== botId);
  const foes = others.filter(u => !state.players[u.ownerId].eliminated);
  const canPayCard = cost => sandbox || (cost <= player.maxMana && cost <= player.mana);
  const actions = [];

  // ---- Cartes en main (une seule fois par carte identique) ----
  const freeCells = deployCells(state, player);
  const deployContext = {
    foes,
    champion: mine.find(u => u.isChampion),
    freeMines: state.mines.filter(m => !m.homeOwnerId && !towerOfMine(state, m))
  };
  const seenCards = new Set();
  for (const { instanceId, cardId } of player.hand) {
    if (seenCards.has(cardId)) continue;
    seenCards.add(cardId);
    const card = cardsById[cardId];
    const spell = spellsById[cardId];
    if (card && canPayCard(card.cost)) {
      for (const c of bestDeployCells(freeCells, card, deployContext)) actions.push({ type: "playCard", instanceId, q: c.q, r: c.r });
    } else if (spell && canPayCard(spell.cost) && usage.canUse(player.cardUses, cardId, spell.uses)) {
      if (spell.targetType === "none") actions.push({ type: "castSpell", instanceId });
      if (spell.targetType === "ally") for (const u of mine) actions.push({ type: "castSpell", instanceId, targetId: u.id });
      if (spell.targetType === "enemy") for (const u of foes) actions.push({ type: "castSpell", instanceId, targetId: u.id });
      if (spell.targetType === "cell" && spell.effect.type === "mud") {
        for (const u of foes) {
          if (!state.mudCells.has(hex.key(u.q, u.r))) actions.push({ type: "castSpell", instanceId, targetCell: { q: u.q, r: u.r } });
        }
      }
    }
  }

  // ---- Unites ----
  for (const unit of mine) {
    if (!unit.hasMoved && effectiveMovement(state, unit) > 0) {
      for (const c of getReachableForUnit(state, unit.id)) actions.push({ type: "moveUnit", unitId: unit.id, q: c.q, r: c.r });
    }
    if (!unit.hasAttacked && unit.attack > 0) {
      for (const target of others) {
        const dist = hex.cubeDistance(unit, target);
        if (dist > 0 && dist <= unit.range) actions.push({ type: "attackUnit", attackerId: unit.id, targetId: target.id });
      }
    }
    for (const abilityId of unit.abilities) {
      const ability = abilitiesById[abilityId];
      if (!ability || ability.passive) continue;
      if (!sandbox && player.mana < ability.cost) continue;
      if (!usage.canUse(unit.abilityUses, abilityId, ability.uses)) continue;
      const use = targetId => actions.push({ type: "useAbility", casterId: unit.id, abilityId, targetId });
      if (ability.targetType === "self") { use(unit.id); continue; }
      const range = ability.isCharge ? effectiveMovement(state, unit) + ability.range : ability.range;
      const pool = ability.targetType === "ally" ? mine : ability.targetType === "enemy" ? others : living;
      for (const target of pool) {
        if (hex.cubeDistance(unit, target) <= range) use(target.id);
      }
    }
  }
  return actions;
}

module.exports = { listActions };
