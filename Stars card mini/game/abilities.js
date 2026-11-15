// Application des effets generiques de competences (voir data/abilities.js).
// Les competences a resolution speciale (Charge, Perforation) sont routees
// avant, dans game/actions/ability.js.

const { cubeDistance } = require("./hexGrid");
const { effectiveDefense, scaleDamage, dealDamage, healUnit } = require("./combat");

function inAbilityRange(caster, targetCell, range) {
  if (range === 0) return true; // effet sur soi-meme
  return cubeDistance(caster, targetCell) <= range;
}

function addBuff(unit, buff) {
  unit.buffs = unit.buffs || [];
  unit.buffs.push(buff);
}

// Un applicateur par type d'effet : (effect, target, damageMultiplier) -> rapport.
const EFFECTS = {
  damage(effect, target, damageMultiplier) {
    const damage = scaleDamage(effect.amount - effectiveDefense(target), damageMultiplier);
    dealDamage(target, damage);
    return { type: "damage", amount: damage, targetKO: target.health <= 0 };
  },
  heal(effect, target) {
    return { type: "heal", amount: healUnit(target, effect.amount) };
  },
  buff_attack(effect, target) {
    addBuff(target, { type: "attack", amount: effect.amount, turnsLeft: effect.duration });
    return { type: "buff_attack", amount: effect.amount, duration: effect.duration };
  },
  buff_defense(effect, target) {
    addBuff(target, { type: "defense", amount: effect.amount, turnsLeft: effect.duration });
    return { type: "buff_defense", amount: effect.amount, duration: effect.duration };
  },
  move(effect, target) {
    // Bonus retire a la fin du tour du proprietaire (voir turns.js#endTurn).
    target.movement += effect.amount;
    target.bonusMovementThisTurn = (target.bonusMovementThisTurn || 0) + effect.amount;
    return { type: "move", amount: effect.amount };
  },
  invisible(effect, target) {
    // Reutilise le systeme de buffs (meme decompte/expiration via
    // tickBuffs) : l'invisibilite est juste un buff de plus, lu par
    // units.js#isInvisible au moment de la serialisation par joueur.
    addBuff(target, { type: "invisible", turnsLeft: effect.duration });
    return { type: "invisible", duration: effect.duration };
  }
};

/**
 * Applique l'effet d'une competence sur `target` (qui peut etre le lanceur
 * lui-meme pour les effets "self"). Retourne un petit rapport utilisable
 * pour les logs / la synchro client.
 */
function applyAbilityEffect(ability, target, damageMultiplier = 1) {
  const apply = EFFECTS[ability.effect.type];
  if (!apply) throw new Error(`Type d'effet de competence inconnu: ${ability.effect.type}`);
  return apply(ability.effect, target, damageMultiplier);
}

/** Decremente les buffs temporaires d'une unite et retire ceux expires. Appele en debut de tour du proprietaire. */
function tickBuffs(unit) {
  if (!unit.buffs || unit.buffs.length === 0) return;
  unit.buffs = unit.buffs
    .map(b => ({ ...b, turnsLeft: b.turnsLeft - 1 }))
    .filter(b => b.turnsLeft > 0);
}

module.exports = { inAbilityRange, applyAbilityEffect, tickBuffs };
