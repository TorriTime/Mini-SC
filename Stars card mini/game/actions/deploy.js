// Action "jouer une carte d'unite" : invocation sur une case de deploiement.

const { addLog } = require("../log");
const { cardsById } = require("../catalog");
const { makeUnitFromCard } = require("../units");
const { unitAt } = require("../battlefield");
const { ownTowersAdjacentTo } = require("../mines");
const { assertCanPayCard, spendMana } = require("../mana");
const { assertTurn } = require("../turns");

function playCard(state, playerId, instanceId, q, r) {
  assertTurn(state, playerId);
  const player = state.players[playerId];
  const cardIndex = player.hand.findIndex(c => c.instanceId === instanceId);
  if (cardIndex === -1) throw new Error("Carte introuvable dans la main.");
  const card = cardsById[player.hand[cardIndex].cardId];
  if (!card) throw new Error("Cette carte est un sort, pas une unite.");

  assertCanPayCard(state, player, card.cost);
  const inBaseZone = state.boardConfig.deployZone(player.side).some(c => c.q === q && c.r === r);
  const adjacentTowers = ownTowersAdjacentTo(state, playerId, q, r);
  if (!inBaseZone && adjacentTowers.length === 0) throw new Error("Case de deploiement invalide.");
  if (unitAt(state, q, r)) throw new Error("Case deja occupee.");

  spendMana(state, player, card.cost);
  // Deploiement avance (a cote d'une tour) : le prochain quart de mana de
  // cette mine n'est pas mine.
  if (!inBaseZone) adjacentTowers.forEach(t => { t.skipQuarter = true; });
  // Bac a sable : la carte n'est jamais retiree de la main (rejouable a l'infini,
  // aucune nouvelle carte n'est creee pour autant).
  if (!state.options.sandbox) player.hand.splice(cardIndex, 1);
  const unit = makeUnitFromCard(card.id, playerId, player.side, { q, r });
  state.units[unit.id] = unit;
  addLog(state, `${player.name} invoque ${card.name}.`);
  return unit;
}

module.exports = { playCard };
