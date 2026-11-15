// Fragments HTML et libelles partages par plusieurs ecrans (deckbuilder,
// main, panneaux d'information). Fonctions pures : donnees -> texte/HTML.

import { $ } from "./dom.js";
import { abilityById } from "./catalog.js";
import { escapeAttr } from "./html.js";

function formatUsesLimit(usesLimit) {
  if (!usesLimit) return null;
  const parts = [];
  if (usesLimit.total != null) parts.push(`${usesLimit.total} au total`);
  if (usesLimit.perTurn != null) parts.push(`${usesLimit.perTurn} par tour`);
  return parts.join(", ");
}

export function abilityTooltipHtml(ability) {
  if (!ability) return "";
  const lines = [`<b>${ability.name}</b>`];
  if (ability.passive) lines.push(`<div class="tt-line">Passif (toujours actif)</div>`);
  else lines.push(`<div class="tt-line">Cout : ${ability.cost} mana - Portee : ${ability.range}</div>`);
  const usesLabel = formatUsesLimit(ability.uses);
  if (usesLabel) lines.push(`<div class="tt-line">Utilisations max : ${usesLabel}</div>`);
  lines.push(`<div class="tt-line">${ability.description}</div>`);
  return lines.join("");
}

/** Valeur prete a inserer dans un attribut data-tooltip="...". */
export const abilityTooltipAttr = ability => escapeAttr(abilityTooltipHtml(ability));

/** Elements <li> decrivant chaque competence (consultation seule, avec infobulle). */
export function abilityListItemsHtml(abilityIds) {
  return (abilityIds || []).map(id => {
    const a = abilityById(id);
    if (!a) return "";
    const costLabel = a.passive ? "passif" : `cout ${a.cost}, portee ${a.range}`;
    return `<li data-tooltip="${abilityTooltipAttr(a)}"><b>${a.name}</b> (${costLabel}) - ${a.description}</li>`;
  }).join("");
}

export const SPELL_TAG = '<span class="spell-tag">SORT</span>';

export function cardStatsLine(card) {
  if (card.type === "spell") return `Sort a ${card.cost} mana`;
  return `ATQ ${card.attack} - PV ${card.health} - MOV ${card.movement} - PORTEE ${card.range}`;
}

export function passiveHtml(entity) {
  return entity.passive ? `<p><b>Passif - ${entity.passive.name}:</b> ${entity.passive.description}</p>` : "";
}

/** Fiche detaillee d'une carte ou d'un champion (panneau du deckbuilder). */
export function showCardDetail(entity, isChampion) {
  const panel = $("card-detail");
  if (entity.type === "spell") {
    panel.innerHTML = `
      <h3>${entity.name} ${SPELL_TAG}</h3>
      <div class="info-stats"><span>Cout: ${entity.cost} mana</span></div>
      <p>${entity.description}</p>
    `;
    return;
  }
  const abilitiesHtml = abilityListItemsHtml(entity.abilities);
  const metaBits = [entity.class, entity.race, entity.role].filter(Boolean);
  panel.innerHTML = `
    <h3>${entity.name}${isChampion ? " (Champion)" : ""}</h3>
    ${metaBits.length ? `<div class="info-stats">${metaBits.map(m => `<span>${m}</span>`).join("")}</div>` : ""}
    <div class="info-stats">
      ${!isChampion ? `<span>Cout: ${entity.cost}</span>` : ""}
      <span>Attaque: ${entity.attack}</span>
      <span>PV: ${entity.health}</span>
      <span>Deplacement: ${entity.movement}</span>
      <span>Portee: ${entity.range}</span>
    </div>
    <p>${entity.description}</p>
    ${passiveHtml(entity)}
    ${abilitiesHtml ? `<ul>${abilitiesHtml}</ul>` : ""}
  `;
}

// ---- Unites en jeu ----

/** Pourcentage de PV restants (0-100). */
export function healthPercent(unit) {
  return Math.max(0, Math.round((unit.health / unit.maxHealth) * 100));
}

export function healthColor(percent) {
  return percent > 50 ? "#6bcf6b" : percent > 20 ? "#e0b34d" : "#e06060";
}

/** Deplacement reel de l'unite, calcule par le serveur (boue et zone sure
 * comprises), ou sa statistique brute a defaut. */
export function effectiveMovementOf(unit) {
  return unit.effectiveMovement != null ? unit.effectiveMovement : unit.movement;
}

/** Deplacement reel avec un indice quand il differe de la statistique de base. */
export function movementLabel(unit) {
  const eff = effectiveMovementOf(unit);
  if (eff === unit.movement) return `${eff}`;
  return eff > unit.movement ? `${eff} (zone sure)` : `${eff} (boue, -1)`;
}

/** Titre + statistiques + passif d'une unite du plateau (panneaux lateraux). */
export function unitSummaryHtml(unit) {
  return `
      <div class="info-title">${unit.name}${unit.isChampion ? " - Champion" : ""}</div>
      <div class="info-stats">
        <span>PV: ${unit.health}/${unit.maxHealth}</span>
        <span>Attaque: ${unit.attack}</span>
        <span>Deplacement: ${movementLabel(unit)}</span>
        <span>Portee: ${unit.range}</span>
      </div>
      ${passiveHtml(unit)}`;
}

/** Libelle " [1/2 ce tour]" a cote d'une competence limitee en utilisations. */
export function usesRemainingLabel(store, key, usesLimit) {
  if (!usesLimit) return "";
  const c = (store && store[key]) || { total: 0, thisTurn: 0 };
  const bits = [];
  if (usesLimit.total != null) bits.push(`${usesLimit.total - c.total}/${usesLimit.total} au total`);
  if (usesLimit.perTurn != null) bits.push(`${usesLimit.perTurn - c.thisTurn}/${usesLimit.perTurn} ce tour`);
  return ` [${bits.join(", ")}]`;
}

// "Mana 3/5 (limite 4) - quarts 2/4" : mana actuel / mana max stockable,
// limite = cout maximal d'une carte, quarts = progression vers la limite suivante.
export function manaLabel(player) {
  return `Mana: ${player.mana}/${player.manaCap} (limite ${player.maxMana}) - quarts ${player.quarters}/4`;
}
