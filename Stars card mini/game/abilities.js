// Application des effets de competences (voir data/abilities.js).
// Systeme volontairement restreint a 5 types d'effets.

const { cubeDistance } = require("./hexGrid");
const { effectiveDefense } = require("./combat");

function inAbilityRange(caster, targetCell, range) {
  if (range === 0) return true; // effet sur soi-meme
  return cubeDistance(caster, targetCell) <= range;
}

/**
 * Applique l'effet d'une competence.
 * caster: unite qui lance la competence (mutee si buff/heal/move sur soi)
 * target: unite ciblee (peut etre === caster pour les effets "self")
 * Retourne un petit rapport utilisable pour les logs / sync client.
 */
function applyAbilityEffect(ability, caster, target) {
  const effect = ability.effect;

  switch (effect.type) {
    case "damage": {
      const defense = effectiveDefense(target);
      const damage = Math.max(1, effect.amount - defense);
      target.health = Math.max(0, target.health - damage);
      return { type: "damage", amount: damage, targetKO: target.health <= 0 };
    }
    case "heal": {
      const before = target.health;
      target.health = Math.min(target.maxHealth, target.health + effect.amount);
      return { type: "heal", amount: target.health - before };
    }
    case "buff_attack": {
      target.buffs = target.buffs || [];
      target.buffs.push({ type: "attack", amount: effect.amount, turnsLeft: effect.duration });
      return { type: "buff_attack", amount: effect.amount, duration: effect.duration };
    }
    case "buff_defense": {
      target.buffs = target.buffs || [];
      target.buffs.push({ type: "defense", amount: effect.amount, turnsLeft: effect.duration });
      return { type: "buff_defense", amount: effect.amount, duration: effect.duration };
    }
    case "move": {
      target.movement += effect.amount;
      target.bonusMovementThisTurn = (target.bonusMovementThisTurn || 0) + effect.amount;
      return { type: "move", amount: effect.amount };
    }
    case "invisible": {
      // Reutilise le systeme de buffs existant (meme decompte/expiration
      // via tickBuffs) : l'invisibilite est juste un buff de plus, lu par
      // gameState.js#isInvisible au moment de la serialisation par joueur.
      target.buffs = target.buffs || [];
      target.buffs.push({ type: "invisible", turnsLeft: effect.duration });
      return { type: "invisible", duration: effect.duration };
    }
    default:
      throw new Error(`Type d'effet de competence inconnu: ${effect.type}`);
  }
}

/** Decremente les buffs temporaires d'une unite et retire ceux expires. Appele en debut de tour du proprietaire. */
function tickBuffs(unit) {
  if (!unit.buffs || unit.buffs.length === 0) return;
  unit.buffs = unit.buffs
    .map(b => ({ ...b, turnsLeft: b.turnsLeft - 1 }))
    .filter(b => b.turnsLeft > 0);
}

module.exports = { inAbilityRange, applyAbilityEffect, tickBuffs };
