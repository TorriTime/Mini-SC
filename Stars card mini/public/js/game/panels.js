// Panneaux d'information de l'ecran de jeu : a gauche (bleu) ma carte ou mon
// unite selectionnee, avec ses competences activables ; a droite (rouge)
// l'unite adverse consultee.

import { $ } from "../dom.js";
import { socket } from "../socket.js";
import { abilityById } from "../catalog.js";
import { abilityTooltipAttr, abilityListItemsHtml, unitSummaryHtml, usesRemainingLabel, SPELL_TAG } from "../views.js";
import { session, clearSelection, myPlayer, isMyTurn, refreshSelection } from "./session.js";

const SPELL_HINTS = {
  ally: "Clique une unite alliee (surlignee) pour cibler ce sort.",
  enemy: "Clique une unite ennemie (surlignee) pour cibler ce sort.",
  cell: "Clique n'importe quelle case du plateau pour cibler ce sort."
};

function handCardHtml(card) {
  if (card.type === "spell") {
    return `
      <div class="info-title">${card.name} (${card.cost} mana) ${SPELL_TAG}</div>
      <p>${card.description}</p>
      <p class="hint">${SPELL_HINTS[card.targetType] || "Effet applique immediatement."}</p>
    `;
  }
  return `
    <div class="info-title">${card.name} (${card.cost} mana)</div>
    <div class="info-stats">
      <span>Attaque: ${card.attack}</span><span>PV: ${card.health}</span>
      <span>Deplacement: ${card.movement}</span><span>Portee: ${card.range}</span>
    </div>
    <p>${card.description}</p>
    <p class="hint">Clique une case verte de ta zone de deploiement pour l'invoquer. Les cases a cote de tes tours d'ouvrier (bordure doree) permettent un deploiement avance, mais la mine concernee perd son prochain quart de mana.</p>
  `;
}

/** Competences de MON unite : boutons activables, etiquette pour les passives. */
function abilityControlsHtml(unit) {
  return (unit.abilities || []).map(id => {
    const ability = abilityById(id);
    if (!ability) return "";
    const tooltip = abilityTooltipAttr(ability);
    if (ability.passive) {
      // Passive (ex: Provocation) : jamais activable, simple etiquette informative.
      return `<span class="ability-btn passive-tag" data-tooltip="${tooltip}">${ability.name} (passif)</span>`;
    }
    const armed = session.armedAbility && session.armedAbility.abilityId === id;
    const remaining = usesRemainingLabel(unit.abilityUses, id, ability.uses);
    return `<button class="ability-btn${armed ? " armed" : ""}" data-ability="${id}" data-tooltip="${tooltip}">${ability.name} (${ability.cost} mana)${remaining}</button>`;
  }).join("");
}

function onAbilityClick(unit, abilityId) {
  const ability = abilityById(abilityId);
  if (!session.state.options.sandbox && myPlayer().mana < ability.cost) return;
  if (ability.targetType === "self") {
    socket.emit("useAbility", { casterId: unit.id, abilityId, targetId: unit.id });
    clearSelection();
  } else {
    // Competence ciblee : "armee", le prochain clic sur une unite la lance.
    session.armedAbility = { abilityId, ability };
  }
  refreshSelection();
}

function renderMyPanel() {
  const panel = $("panel-mine-content");

  if (session.selectedHand) {
    panel.innerHTML = handCardHtml(session.selectedHand.card);
    return;
  }

  // Toujours une de MES unites (les unites adverses vont dans le panneau rouge).
  const unit = session.selectedUnitId ? session.state.units[session.selectedUnitId] : null;
  if (!unit) {
    panel.innerHTML = `<p class="hint">Selectionne une unite ou une carte pour voir ses informations.</p>`;
    return;
  }

  panel.innerHTML = `${unitSummaryHtml(unit)}
      <div>${abilityControlsHtml(unit)}</div>
      ${isMyTurn() ? "" : `<p class="hint">Ce n'est pas ton tour.</p>`}
    `;

  if (isMyTurn()) {
    panel.querySelectorAll(".ability-btn[data-ability]").forEach(btn => {
      btn.addEventListener("click", () => onAbilityClick(unit, btn.dataset.ability));
    });
  }
}

// Simple consultation d'une unite adverse, aucune action possible.
function renderEnemyPanel() {
  const panel = $("panel-theirs-content");
  const unit = session.inspectedEnemyId ? session.state.units[session.inspectedEnemyId] : null;
  if (!unit) {
    panel.innerHTML = `<p class="hint">Clique une unite adverse pour voir ses informations.</p>`;
    return;
  }
  const abilitiesHtml = abilityListItemsHtml(unit.abilities);
  panel.innerHTML = `${unitSummaryHtml(unit)}
      ${abilitiesHtml ? `<ul>${abilitiesHtml}</ul>` : ""}
    `;
}

export function renderPanels() {
  renderMyPanel();
  renderEnemyPanel();
}
