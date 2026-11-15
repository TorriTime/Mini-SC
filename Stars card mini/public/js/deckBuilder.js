// Ecran "Mon Deck" : gestion des decks, choix du champion, filtres du pool
// de cartes et composition du deck actif.

import { $, onClick, showScreen } from "./dom.js";
import { catalog, isCatalogLoaded, playableCards, cardById, abilityById } from "./catalog.js";
import { escapeAttr } from "./html.js";
import { abilityTooltipHtml, cardStatsLine, showCardDetail, SPELL_TAG } from "./views.js";
import * as decks from "./deckStore.js";

// ---- Filtres (cumulables : OU dans une categorie, ET entre categories) ----
const filters = {
  costs: new Set(),
  types: new Set(),
  classes: new Set(),
  races: new Set(),
  roles: new Set(),
  sort: null // "asc" | "desc" | null
};

const COST_CHOICES = Array.from({ length: 15 }, (_, i) => i + 1); // cout fixe 1-15 (cahier des charges)
const TYPE_LABELS = { unit: "Pion", spell: "Sort" };

/** Valeurs REELLEMENT presentes dans les donnees pour un champ (jamais codees en dur). */
function uniqueValues(field) {
  const values = new Set();
  playableCards().forEach(c => { if (c[field]) values.add(c[field]); });
  return [...values].sort();
}

function matchesFilters(card) {
  if (filters.costs.size > 0 && !filters.costs.has(card.cost)) return false;
  if (filters.types.size > 0 && !filters.types.has(card.type)) return false;
  if (filters.classes.size > 0 && !(card.class && filters.classes.has(card.class))) return false;
  if (filters.races.size > 0 && !(card.race && filters.races.has(card.race))) return false;
  if (filters.roles.size > 0 && !(card.role && filters.roles.has(card.role))) return false;
  return true;
}

function filteredPool() {
  const pool = playableCards().filter(matchesFilters);
  if (!filters.sort) return pool;
  const direction = filters.sort === "asc" ? 1 : -1;
  return pool.sort((a, b) => direction * a.name.localeCompare(b.name));
}

function resetFilters() {
  for (const key of ["costs", "types", "classes", "races", "roles"]) filters[key].clear();
  filters.sort = null;
}

function renderFilterChips(containerId, values, selectedSet, labelOf = v => v) {
  const el = $(containerId);
  el.innerHTML = "";
  values.forEach(value => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip" + (selectedSet.has(value) ? " selected" : "");
    btn.textContent = labelOf(value);
    btn.addEventListener("click", () => {
      if (selectedSet.has(value)) selectedSet.delete(value); else selectedSet.add(value);
      renderDeckBuilder();
    });
    el.appendChild(btn);
  });
}

function renderFilters() {
  renderFilterChips("filter-cost", COST_CHOICES, filters.costs);
  renderFilterChips("filter-type", uniqueValues("type"), filters.types, v => TYPE_LABELS[v] || v);
  renderFilterChips("filter-class", uniqueValues("class"), filters.classes);
  renderFilterChips("filter-race", uniqueValues("race"), filters.races);
  renderFilterChips("filter-role", uniqueValues("role"), filters.roles);
  document.querySelectorAll("[data-sort]").forEach(btn => {
    btn.classList.toggle("selected", filters.sort === btn.dataset.sort);
  });
}

// ---- Barre d'outils : choix du deck en cours d'edition + actions ----
function toolbarButton(label, className, onClickHandler) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.textContent = label;
  btn.addEventListener("click", onClickHandler);
  return btn;
}

function renderToolbar() {
  const select = document.createElement("select");
  select.id = "deck-select";
  decks.allDecks().forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = `${d.name} (${d.cardIds.length})`;
    if (decks.isActiveDeck(d)) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener("change", () => { decks.setActiveDeck(select.value); renderDeckBuilder(); });

  const btnDelete = toolbarButton("Supprimer", "danger", () => {
    if (window.confirm(`Supprimer definitivement le deck "${decks.activeDeck().name}" ?`)) {
      decks.deleteActiveDeck();
      renderDeckBuilder();
    }
  });
  btnDelete.disabled = !decks.canDeleteDeck();

  $("deck-toolbar").replaceChildren(
    select,
    toolbarButton("Nouveau", "secondary", () => { decks.createDeck(); renderDeckBuilder(); }),
    toolbarButton("Renommer", "secondary", () => {
      if (decks.renameActiveDeck(window.prompt("Nom du deck :", decks.activeDeck().name))) renderDeckBuilder();
    }),
    toolbarButton("Dupliquer", "secondary", () => { decks.duplicateActiveDeck(); renderDeckBuilder(); }),
    btnDelete
  );
}

// ---- Champion ----
function championTooltip(champ) {
  const ability = abilityById((champ.abilities || [])[0]);
  const bits = [];
  if (champ.passive) bits.push(`<div class="tt-line"><b>${champ.passive.name}</b> (passif) - ${champ.passive.description}</div>`);
  if (ability) bits.push(abilityTooltipHtml(ability));
  return `<b>${champ.name}</b><div class="tt-line">${champ.description}</div>` + bits.join("");
}

function renderChampionPicker(deck) {
  const picker = $("champion-picker");
  picker.innerHTML = "";
  catalog.champions.forEach(champ => {
    const div = document.createElement("div");
    div.className = "champion-option" + (deck.championId === champ.id ? " selected" : "");
    div.setAttribute("data-tooltip", escapeAttr(championTooltip(champ)));
    div.innerHTML = `<h4>${champ.name}</h4><small>ATQ ${champ.attack} - PV ${champ.health} - MOV ${champ.movement} - PORTEE ${champ.range}</small>`;
    div.addEventListener("click", () => {
      decks.setChampion(champ.id);
      renderDeckBuilder();
      showCardDetail(champ, true);
    });
    picker.appendChild(div);
  });
}

// ---- Pool de cartes et contenu du deck ----
/** Ligne de carte : clic sur le texte = fiche detaillee, bouton = action. */
function cardRow(card, titleHtml, buttonHtml, onButtonClick) {
  const row = document.createElement("div");
  row.className = "card-row";
  row.innerHTML = `
    <div>
      <div>${titleHtml}${card.type === "spell" ? " " + SPELL_TAG : ""}</div>
      <div class="stats">${cardStatsLine(card)}</div>
    </div>
    ${buttonHtml}
  `;
  row.querySelector("div").addEventListener("click", () => showCardDetail(card, false));
  row.querySelector("button").addEventListener("click", e => {
    e.stopPropagation();
    onButtonClick();
    renderDeckBuilder();
  });
  return row;
}

// Le pool affiche les unites puis les sorts, filtres/tries instantanement.
function renderCardPool() {
  const list = $("card-pool-list");
  list.innerHTML = "";
  filteredPool().forEach(card => {
    const count = decks.countInDeck(card.id);
    list.appendChild(cardRow(
      card,
      `<b>${card.name}</b> <span class="cost">(${card.cost})</span>`,
      `<button ${decks.canAddCard(card.id) ? "" : "disabled"}>+ (${count}/${decks.MAX_COPIES})</button>`,
      () => decks.addCard(card.id)
    ));
  });
}

// Le deck lui-meme n'est jamais filtre : ce qui y est ajoute y reste visible.
function renderDeckList(deck) {
  const list = $("deck-list");
  list.innerHTML = "";
  [...new Set(deck.cardIds)].forEach(id => {
    const card = cardById(id);
    list.appendChild(cardRow(
      card,
      `<b>${card.name}</b> x${decks.countInDeck(id)}`,
      "<button>-</button>",
      () => decks.removeCard(id)
    ));
  });
  $("deck-count").textContent = deck.cardIds.length;
}

/** Avertissement "deck incomplet" : tant qu'il manque des cartes, impossible
 * de quitter le deckbuilder ou de lancer une partie (le joueur peut continuer
 * a modifier son deck librement). */
export function updateDeckWarning() {
  const missing = decks.missingCards();
  $("deck-warning").textContent = missing > 0
    ? `Il manque ${missing} carte(s) pour atteindre le minimum de ${decks.MIN_DECK_SIZE}. Impossible de lancer une partie ou de quitter ce menu.`
    : "";
}

export function renderDeckBuilder() {
  if (!isCatalogLoaded()) return;
  const deck = decks.activeDeck();
  renderToolbar();
  renderChampionPicker(deck);
  renderFilters();
  renderCardPool();
  renderDeckList(deck);
  updateDeckWarning();
}

/** Ouvre le deckbuilder (ex : pour completer un deck invalide avant de jouer). */
export function openDeckBuilder() {
  renderDeckBuilder();
  showScreen("screen-deck");
}

export function initDeckBuilder() {
  document.querySelectorAll("[data-sort]").forEach(btn => {
    btn.addEventListener("click", () => {
      filters.sort = filters.sort === btn.dataset.sort ? null : btn.dataset.sort;
      renderDeckBuilder();
    });
  });
  onClick("btn-filters-reset", () => { resetFilters(); renderDeckBuilder(); });
  onClick("btn-deck-back", () => {
    if (!decks.deckIsValid()) { updateDeckWarning(); return; }
    showScreen("screen-menu");
  });
}
