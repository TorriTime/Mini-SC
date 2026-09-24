// Application des effets de sorts (voir data/spells.js).
// Volontairement restreint a 3 effets pour ce prototype : damage, heal, draw.
// L'effet "draw" est gere directement dans gameState.js car il a besoin
// d'acceder a la pioche/main du joueur, pas seulement a une unite.

function applyDamage(target, amount) {
  target.health = Math.max(0, target.health - amount);
  return { type: "damage", amount, targetKO: target.health <= 0 };
}

function applyHeal(target, amount) {
  const before = target.health;
  target.health = Math.min(target.maxHealth, target.health + amount);
  return { type: "heal", amount: target.health - before };
}

module.exports = { applyDamage, applyHeal };
