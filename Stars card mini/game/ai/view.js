// Copies de l'etat de partie pour l'IA : elle reflechit en simulant ses
// actions avec le VRAI moteur de jeu, sur une copie.

const { isUnitVisibleTo } = require("../units");

const deepCopy = value => JSON.parse(JSON.stringify(value));

/** Copie independante d'un etat (le plateau, immuable, est partage ; le
 * journal n'est pas copie). */
function cloneState(state) {
  return {
    ...state,
    players: deepCopy(state.players),
    units: deepCopy(state.units),
    traps: deepCopy(state.traps),
    mines: deepCopy(state.mines),
    order: state.order.slice(),
    turnOrder: state.turnOrder.slice(),
    mudCells: new Set(state.mudCells),
    log: []
  };
}

/** Ce que le joueur `botId` a le droit de savoir : l'IA ne triche pas. Les
 * unites adverses invisibles et les pieges adverses sont absents de la
 * copie (comme dans la vue envoyee a un joueur humain), de meme que la main,
 * la pioche et la defausse des autres joueurs. */
function botView(state, botId) {
  const view = cloneState(state);
  for (const [id, unit] of Object.entries(view.units)) {
    if (!isUnitVisibleTo(unit, botId)) delete view.units[id];
  }
  for (const [id, trap] of Object.entries(view.traps)) {
    if (trap.ownerId !== botId) delete view.traps[id];
  }
  for (const player of Object.values(view.players)) {
    if (player.id === botId) continue;
    player.hand = [];
    player.deck = [];
    player.graveyard = [];
  }
  return view;
}

module.exports = { cloneState, botView };
