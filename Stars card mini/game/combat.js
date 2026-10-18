// Resolution des combats : portee, degats, buffs temporaires, passifs.

const { cubeDistance } = require("./hexGrid");

function effectiveAttack(unit) {
  let atk = unit.attack;
  for (const b of unit.buffs || []) {
    if (b.type === "attack") atk += b.amount;
  }
  if (unit.isChampion && unit.passive && unit.passive.type === "frenzy") {
    if (unit.health <= unit.maxHealth * 0.5) {
      atk += unit.passive.amount;
    }
  }
  return atk;
}

function effectiveDefense(unit) {
  let def = 0;
  for (const b of unit.buffs || []) {
    if (b.type === "defense") def += b.amount;
  }
  return def;
}

/** Degats apres reduction (ex : Noyau celeste, multiplicateur 0.85), minimum 1. */
function scaleDamage(amount, multiplier = 1) {
  return Math.max(1, Math.round(amount * multiplier));
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
  const rawAttack = effectiveAttack(attacker);
  const defense = effectiveDefense(target);
  const damage = scaleDamage(rawAttack - defense, damageMultiplier);
  target.health = Math.max(0, target.health - damage);
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

module.exports = { scaleDamage, effectiveAttack, effectiveDefense, inRange, resolveAttack, canRetaliate };
