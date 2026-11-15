// Decks du joueur : plusieurs decks nommes, sauvegardes dans le navigateur
// (localStorage). Aucun affichage ici.
//
// Le deck "actif" est celui EN COURS D'EDITION dans le deckbuilder ; le deck
// reellement utilise pour une partie est choisi separement dans le salon
// d'attente (voir lobby.js) et n'a pas besoin d'etre le meme.

import { catalog } from "./catalog.js";

const DECKS_KEY = "starsCardsDecksV2";
const LEGACY_DECK_KEY = "starsCardsDeck"; // ancien format mono-deck, migre si present
const DEFAULT_CHAMPION = "kael";
const DEFAULT_DECK_CARDS = ["worker", "soldier", "scout", "archer", "tank", "berserker", "militia", "healer", "knight", "heal", "strike", "draw"];

export const MIN_DECK_SIZE = 10;
export const MAX_COPIES = 2; // exemplaires maximum d'une meme carte dans un deck

function uid() {
  return "d_" + Math.random().toString(36).slice(2, 10);
}

function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
}

function loadDecks() {
  const saved = readJson(DECKS_KEY);
  if (Array.isArray(saved) && saved.length > 0) return saved;
  const legacy = readJson(LEGACY_DECK_KEY);
  const base = (legacy && Array.isArray(legacy.cardIds) && legacy.cardIds.length >= MIN_DECK_SIZE)
    ? legacy
    : { championId: DEFAULT_CHAMPION, cardIds: DEFAULT_DECK_CARDS.slice() };
  return [{ id: uid(), name: "Deck 1", championId: base.championId, cardIds: base.cardIds.slice() }];
}

let decks = loadDecks();
let activeDeckId = decks[0].id;

function save() {
  localStorage.setItem(DECKS_KEY, JSON.stringify(decks));
}

function addDeck(deck) {
  decks.push(deck);
  activeDeckId = deck.id;
  save();
}

export const allDecks = () => decks;
export const deckById = id => decks.find(d => d.id === id);
export const activeDeck = () => deckById(activeDeckId) || decks[0];
export const isActiveDeck = deck => deck.id === activeDeckId;
export const canDeleteDeck = () => decks.length > 1; // toujours garder au moins un deck

export function setActiveDeck(id) {
  activeDeckId = id;
}

/** Un deck est jouable a partir de MIN_DECK_SIZE cartes (par defaut : le deck actif). */
export function deckIsValid(deck = activeDeck()) {
  return deck.cardIds.length >= MIN_DECK_SIZE;
}

export function missingCards(deck = activeDeck()) {
  return MIN_DECK_SIZE - deck.cardIds.length;
}

export function createDeck() {
  const championId = (catalog.champions[0] && catalog.champions[0].id) || DEFAULT_CHAMPION;
  addDeck({ id: uid(), name: `Deck ${decks.length + 1}`, championId, cardIds: [] });
}

export function duplicateActiveDeck() {
  const src = activeDeck();
  addDeck({ id: uid(), name: src.name + " (copie)", championId: src.championId, cardIds: src.cardIds.slice() });
}

export function deleteActiveDeck() {
  if (!canDeleteDeck()) return;
  decks = decks.filter(d => d.id !== activeDeckId);
  activeDeckId = decks[0].id;
  save();
}

/** Renomme le deck actif ; retourne false si le nom est vide. */
export function renameActiveDeck(name) {
  if (!name || !name.trim()) return false;
  activeDeck().name = name.trim();
  save();
  return true;
}

export function setChampion(championId) {
  activeDeck().championId = championId;
  save();
}

export function countInDeck(cardId) {
  return activeDeck().cardIds.filter(id => id === cardId).length;
}

export const canAddCard = cardId => countInDeck(cardId) < MAX_COPIES;

export function addCard(cardId) {
  if (!canAddCard(cardId)) return;
  activeDeck().cardIds.push(cardId);
  save();
}

/** Retire UN exemplaire de la carte du deck actif. */
export function removeCard(cardId) {
  const cardIds = activeDeck().cardIds;
  const idx = cardIds.indexOf(cardId);
  if (idx !== -1) cardIds.splice(idx, 1);
  save();
}
