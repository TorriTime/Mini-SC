// Resolution des combats : portee, degats, soins, buffs temporaires.

const { cubeDistance } = require("./hexGrid");
const passives = require("./passives");

function sumBuffs(unit, type) {
  let total = 0;
  for (const b of unit.buffs || []) {
    if (b.type === type) total += b.amount;
  }
  return total;
}

function effectiveAttack(unit) {
  return unit.attack + sumBuffs(unit, "attack") + passives.attackBonus(unit);
}

function effectiveDefense(unit) {
  return sumBuffs(unit, "defense");
}

/** Degats apres reduction (ex : Noyau celeste, multiplicateur 0.85), minimum 1. */
function scaleDamage(amount, multiplier = 1) {
  return Math.max(1, Math.round(amount * multiplier));
}

/** Retire `damage` PV (jamais en dessous de 0). */
function dealDamage(unit, damage) {
  unit.health = Math.max(0, unit.health - damage);
}

/** Rend `amount` PV (jamais au-dessus du maximum). Retourne les PV reellement rendus. */
function healUnit(unit, amount) {
  const before = unit.health;
  unit.health = Math.min(unit.maxHealth, unit.health + amount);
  return unit.health - before;
}

function inRange(attacker, target) {
  const dist = cubeDistance(attacker, target);
  return dist <= attacker.range && dist > 0;
}

/**
 * Applique une attaque de `attacker` sur `target`. Mute directement les
 * unites (health). Retourne le rapport de degats.
 */
function resolveAttack(attacker, target, damageMultiplier = 1) {
  const damage = scaleDamage(effectiveAttack(attacker) - effectiveDefense(target), damageMultiplier);
  dealDamage(target, damage);
  return { damage, targetHealth: target.health, targetKO: target.health <= 0 };
}

/**
 * Une unite peut riposter si elle est encore en vie apres avoir subi
 * l'attaque et si l'attaquant se trouve a portee de SA propre portee
 * d'attaque (ex : portee 1 attaquee a distance 3 -> pas de riposte ;
 * portee 3 attaquee a distance 2 -> riposte possible).
 */
function canRetaliate(defender, attacker) {
  if (defender.health <= 0) return false;
  if (!defender.range || defender.range <= 0) return false;
  return inRange(defender, attacker);
}

module.exports = {
  effectiveAttack,
  effectiveDefense,
  scaleDamage,
  dealDamage,
  healUnit,
  inRange,
  resolveAttack,
  canRetaliate
};
