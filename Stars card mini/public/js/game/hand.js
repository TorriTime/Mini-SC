// Main du joueur : affichage des cartes et selection au clic.

import { $ } from "../dom.js";
import { socket } from "../socket.js";
import { cardById, abilityById } from "../catalog.js";
import { abilityTooltipAttr, showCardDetail, SPELL_TAG } from "../views.js";
import { session, clearSelection, myPlayer, isMyTurn, refreshSelection } from "./session.js";

function abilityTagsHtml(card) {
  return (card.abilities || []).map(id => {
    const ability = abilityById(id);
    return ability ? `<span class="ability-mini-tag" data-tooltip="${abilityTooltipAttr(ability)}">${ability.name}</span>` : "";
  }).join(" ");
}

function cardHtml(card) {
  if (card.type === "spell") {
    return `
      <div class="cost">${card.cost} mana</div>
      <div class="name">${card.name} ${SPELL_TAG}</div>
      <div class="stats">${card.description}</div>
    `;
  }
  const abilityTags = abilityTagsHtml(card);
  return `
    <div class="cost">${card.cost} mana</div>
    <div class="name">${card.name}</div>
    <div class="stats">ATQ ${card.attack} / PV ${card.health}</div>
    <div class="stats">MOV ${card.movement} / PORTEE ${card.range}</div>
    ${abilityTags ? `<div class="stats">${abilityTags}</div>` : ""}
  `;
}

function onCardClick(instanceId, card) {
  if (!isMyTurn()) return;
  showCardDetail(card, false);

  // Sort sans cible (ex : Ravitaillement) : effet immediat au clic, le mana
  // n'est consomme que si le serveur valide effectivement l'action.
  if (card.type === "spell" && card.targetType === "none") {
    socket.emit("castSpell", { instanceId, targetId: null });
    return;
  }

  // Un second clic sur la carte selectionnee la deselectionne.
  const wasSelected = session.selectedHand && session.selectedHand.instanceId === instanceId;
  clearSelection();
  if (!wasSelected) session.selectedHand = { instanceId, card };
  refreshSelection();
}

export function renderHand() {
  const player = myPlayer();
  const sandbox = session.state.options.sandbox;
  const row = $("hand-row");
  row.innerHTML = "";
  (player.hand || []).forEach(({ instanceId, cardId }) => {
    const card = cardById(cardId);
    const affordable = sandbox || (player.mana >= card.cost && card.cost <= player.maxMana);
    const selected = session.selectedHand && session.selectedHand.instanceId === instanceId;
    const div = document.createElement("div");
    div.className = "hand-card" + (card.type === "spell" ? " spell" : "") +
      (selected ? " selected" : "") + (!affordable ? " unaffordable" : "");
    div.innerHTML = cardHtml(card);
    div.addEventListener("click", () => onCardClick(instanceId, card));
    row.appendChild(div);
  });
}
