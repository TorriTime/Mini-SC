// Moteur de jeu autoritaire (cote serveur) : point d'entree unique.
// Le client n'est jamais source de verite : chaque action passe par une des
// fonctions exportees ici, qui valide puis mute l'etat de partie `state`
// (cree par createGame). En cas de refus, l'action leve une Error dont le
// message est destine au joueur, sans avoir rien modifie.
//
// Organisation de game/ :
//   lobby.js        creation, salon d'attente, decks, lancement, deconnexion
//   turns.js        tour actif, pioche, debut/fin de tour, morts, eliminations
//   actions/        une action de joueur par fichier (deploy, move, attack,
//                   ability, spell)
//   serialize.js    vue de la partie envoyee a chaque joueur
//   units.js, battlefield.js, mines.js, traps.js, mana.js, combat.js,
//   abilities.js, spells.js, passives.js, usage.js    regles par theme
//   hexGrid.js, movement.js                           plateau et deplacement
//   catalog.js, constants.js, options.js, random.js, log.js    socle commun

const { MIN_DECK_SIZE } = require("./constants");
const { DEFAULT_OPTIONS } = require("./options");
const { createGame, joinGame, setPlayerLoadout, allPlayersReady, startGame, removePlayer } = require("./lobby");
const { activePlayerId, endTurn, forfeit } = require("./turns");
const { playCard } = require("./actions/deploy");
const { moveUnit } = require("./actions/move");
const { attackUnit } = require("./actions/attack");
const { useAbility } = require("./actions/ability");
const { castSpell } = require("./actions/spell");
const { getReachableForUnit } = require("./battlefield");
const { isUnitVisibleTo } = require("./units");
const { serializeForPlayer } = require("./serialize");

module.exports = {
  MIN_DECK_SIZE,
  DEFAULT_OPTIONS,
  createGame,
  joinGame,
  setPlayerLoadout,
  allPlayersReady,
  startGame,
  playCard,
  moveUnit,
  attackUnit,
  useAbility,
  castSpell,
  endTurn,
  forfeit,
  removePlayer,
  serializeForPlayer,
  getReachableForUnit,
  activePlayerId,
  isUnitVisibleTo
};
