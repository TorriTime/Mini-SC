// Action "lancer un sort" depuis la main (voir data/spells.js). Les effets
// eux-memes vivent dans game/spells.js.

const { addLog } = require("../log");
const { spellsById } = require("../catalog");
const { spellEffectHandler } = require("../spells");
const { assertCanPayCard, spendMana } = require("../mana");
const { assertTurn } = require("../turns");
const usage = require("../usage");
const { requireUnitTarget } = require("./targeting");

function castSpell(state, playerId, instanceId, targetId, targetCell) {
  assertTurn(state, playerId);
  const player = state.players[playerId];
  const handIndex = player.hand.findIndex(c => c.instanceId === instanceId);
  if (handIndex === -1) throw new Error("Sort introuvable dans la main.");
  const cardId = player.hand[handIndex].cardId;
  const spell = spellsById[cardId];
  if (!spell) throw new Error("Cette carte n'est pas un sort.");
  assertCanPayCard(state, player, spell.cost);
  if (!usage.canUse(player.cardUses, cardId, spell.uses)) {
    throw new Error("Nombre d'utilisations maximum atteint pour ce sort.");
  }

  const ctx = { playerId, effect: spell.effect, target: null, cell: null };
  if (spell.targetType === "ally" || spell.targetType === "enemy") {
    ctx.target = requireUnitTarget(state, playerId, targetId, spell.targetType);
  } else if (spell.targetType === "cell") {
    if (!targetCell || !state.boardConfig.inBounds(targetCell.q, targetCell.r)) {
      throw new Error("Case cible invalide.");
    }
    ctx.cell = { q: targetCell.q, r: targetCell.r };
  }
  const handler = spellEffectHandler(spell.effect.type);
  if (handler.validate) handler.validate(state, ctx);

  // Le mana et la carte ne sont consommes qu'une fois la cible validee :
  // une selection annulee cote client (aucun evenement envoye) ne coute rien.
  spendMana(state, player, spell.cost);
  usage.recordUse(player.cardUses, cardId);
  const [handCard] = player.hand.splice(handIndex, 1);
  if (state.options.sandbox) {
    // Bac a sable : la carte retourne aussitot en main (rejouable a l'infini).
    player.hand.push(handCard);
  } else {
    player.graveyard.push(handCard); // defausse, reutilisable via l'option "reshuffleDiscard"
  }

  const result = handler.apply(state, ctx);
  addLog(state, `${player.name} lance ${spell.name}.`);
  return result;
}

module.exports = { castSpell };
