// Action "utiliser une competence" (voir data/abilities.js) : validation,
// puis routage vers la Charge, la Perforation ou un effet generique.

const hex = require("../hexGrid");
const { addLog } = require("../log");
const { abilitiesById } = require("../catalog");
const { revealFromInvisibility } = require("../units");
const { reachableCells, shortestPath } = require("../movement");
const { unitAt, occupiedSet, ownsUnit, effectiveMovement, damageMultiplier } = require("../battlefield");
const { effectiveDefense, scaleDamage, dealDamage } = require("../combat");
const { inAbilityRange, applyAbilityEffect } = require("../abilities");
const { markAggressionNearMines } = require("../mines");
const { triggerTrapsAlongPath } = require("../traps");
const { canAfford, spendMana } = require("../mana");
const { assertTurn, resolveDeaths } = require("../turns");
const usage = require("../usage");
const { performAttack, assertValidAttackTarget } = require("./attack");
const { requireUnitTarget } = require("./targeting");

/** Case d'ou `caster` attaquera `target` : sa case actuelle s'il est deja a
 * portee, sinon la case atteignable (via son deplacement NORMAL, donc sans
 * jamais traverser une case occupee) la plus proche de la cible et a portee
 * d'attaque une fois arrivee. null si aucune ne convient. */
function chargeDestination(state, caster, target, range, occupied) {
  if (hex.cubeDistance(caster, target) <= range) return { q: caster.q, r: caster.r };
  const candidates = reachableCells(state.boardConfig, caster, effectiveMovement(state, caster), occupied)
    .filter(c => hex.cubeDistance(c, target) <= range)
    .sort((a, b) => hex.cubeDistance(a, target) - hex.cubeDistance(b, target));
  return candidates[0] || null;
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

  const occupied = occupiedSet(state, caster.id);
  const destination = chargeDestination(state, caster, target, ability.range, occupied);
  if (!destination) {
    throw new Error("Charge impossible : aucun chemin valide vers la cible (hors de portee de deplacement).");
  }

  assertValidAttackTarget(state, { ownerId: caster.ownerId, range: ability.range, q: destination.q, r: destination.r }, target);

  // Chemin REEL vers la destination (pour l'animation cote client et pour
  // detecter les pieges traverses) -- calcule maintenant, avec les memes
  // parametres que la recherche ci-dessus, donc forcement valide.
  const path = shortestPath(state.boardConfig, caster, destination, effectiveMovement(state, caster), occupied)
    || [{ q: caster.q, r: caster.r }];

  // Toutes les verifications sont passees : on peut muter (mana, position, attaque).
  spendMana(state, player, ability.cost);
  const moved = destination.q !== caster.q || destination.r !== caster.r;
  caster.q = destination.q;
  caster.r = destination.r;
  caster.hasMoved = true;
  const triggeredTraps = triggerTrapsAlongPath(state, caster, path);

  const attackReport = performAttack(state, caster, target, "charge");
  return { ...attackReport, moved, path, unitId: caster.id, triggeredTraps };
}

/**
 * Perforation : touche TOUTES les unites ennemies alignees sur la ligne de
 * tir entre l'attaquant et la cible (les allies sont epargnes mais ne
 * bloquent pas le tir). Chaque unite n'est touchee qu'une fois (la ligne
 * hexagonale ne visite jamais deux fois la meme case). Aucune propagation
 * en chaine : une seule passe sur la ligne calculee au depart.
 */
function resolvePerforation(state, caster, target, ability) {
  const hits = [];
  for (const cell of hex.hexLine(caster, target)) {
    if (cell.q === caster.q && cell.r === caster.r) continue; // case de depart
    const unit = unitAt(state, cell.q, cell.r);
    if (!unit) continue;
    if (unit.ownerId === caster.ownerId) continue; // allies epargnes
    const damage = scaleDamage(ability.effect.amount - effectiveDefense(unit), damageMultiplier(state, unit));
    dealDamage(unit, damage);
    markAggressionNearMines(state, caster, unit);
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
    const target = requireUnitTarget(state, playerId, targetId, "enemy");
    const result = resolveCharge(state, player, caster, ability, target);
    usage.recordUse(caster.abilityUses, abilityId);
    addLog(state, `${caster.name} utilise ${ability.name}.`);
    return result;
  }

  const targetsEnemy = ability.targetType === "enemy";
  let target = caster;
  if (ability.targetType !== "self") {
    target = requireUnitTarget(state, playerId, targetId, ability.targetType);
    if (!inAbilityRange(caster, target, ability.range)) throw new Error("Cible hors de portee.");
    if (targetsEnemy) assertValidAttackTarget(state, caster, target);
  }

  spendMana(state, player, ability.cost);
  usage.recordUse(caster.abilityUses, abilityId);
  if (targetsEnemy) revealFromInvisibility(caster); // agir contre un ennemi revele toujours l'unite

  if (ability.isPiercing) {
    const hits = resolvePerforation(state, caster, target, ability);
    addLog(state, `${caster.name} utilise ${ability.name} (${hits.length} unite(s) touchee(s)).`);
    resolveDeaths(state, hits.map(h => h.unit));
    return { type: "piercing", hits: hits.map(h => ({ unitId: h.unit.id, damage: h.damage })) };
  }

  const result = applyAbilityEffect(ability, target, damageMultiplier(state, target));
  addLog(state, `${caster.name} utilise ${ability.name}.`);
  if (targetsEnemy) markAggressionNearMines(state, caster, target);
  resolveDeaths(state, [target]);
  return result;
}

module.exports = { useAbility };
