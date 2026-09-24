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

function inRange(attacker, target) {
  const dist = cubeDistance(attacker, target);
  return dist <= attacker.range && dist > 0;
}

/**
 * Applique une attaque de `attacker` sur `target`. Mute directement les
 * unites (health). Retourne le rapport de degats.
 */
function resolveAttack(attacker, target) {
  const rawAttack = effectiveAttack(attacker);
  const defense = effectiveDefense(target);
  const damage = Math.max(1, rawAttack - defense);
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

module.exports = { effectiveAttack, effectiveDefense, inRange, resolveAttack, canRetaliate };
