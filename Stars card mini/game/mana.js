// Regles de mana. En bac a sable (options.sandbox) le mana est illimite :
// rien n'est verifie ni depense.

/** Mana maximal stockable : la limite + le mana additionnel qui "recouvre"
 * (la moitie de la limite, arrondie a l'inferieur). Ex : limite 2 -> 3 de
 * mana au total, mais aucune carte a 3 n'est jouable (limite 2). */
function manaCap(player) {
  return player.maxMana + Math.floor(player.maxMana / 2);
}

function canAfford(state, player, cost) {
  return state.options.sandbox || player.mana >= cost;
}

/** Une CARTE (unite ou sort) ne peut jamais couter plus que la limite de mana,
 * meme si le mana additionnel permettrait de payer le total. */
function assertCanPayCard(state, player, cost) {
  if (state.options.sandbox) return;
  if (cost > player.maxMana) {
    throw new Error(`Cout trop eleve : votre limite de mana est de ${player.maxMana}.`);
  }
  if (player.mana < cost) throw new Error("Mana insuffisant.");
}

function spendMana(state, player, cost) {
  if (state.options.sandbox) return;
  player.mana -= cost;
}

/** Gain de debut de tour : +limite de mana. Le mana non depense est conserve
 * d'un tour a l'autre, dans la limite de manaCap. */
function gainTurnMana(player) {
  player.mana = Math.min(manaCap(player), player.mana + player.maxMana);
}

module.exports = { manaCap, canAfford, assertCanPayCard, spendMana, gainTurnMana };
