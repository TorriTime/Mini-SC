// Etat de l'ecran de jeu cote client : dernier etat recu du serveur +
// selection en cours. Le serveur reste seul juge des regles ; ceci ne sert
// qu'a l'affichage et a savoir quelle action proposer au prochain clic.

export const session = {
  state: null,            // dernier etat de partie recu (vue du joueur, voir game/serialize.js)
  selectedHand: null,     // { instanceId, card } : carte de la main selectionnee
  selectedUnitId: null,   // toujours une de MES unites (panneau bleu, a gauche)
  inspectedEnemyId: null, // unite adverse consultee (panneau rouge, a droite)
  reachableCells: [],     // [{q,r}] cases de deplacement de l'unite selectionnee
  armedAbility: null,     // { abilityId, ability } : competence en attente de cible
  animations: {}          // unitId -> { q, r, timer } : position affichee PENDANT un deplacement anime
};

export function clearSelection() {
  session.selectedHand = null;
  session.selectedUnitId = null;
  session.inspectedEnemyId = null;
  session.reachableCells = [];
  session.armedAbility = null;
}

export const myId = () => session.state.you;
export const myPlayer = () => session.state.players[session.state.you];
export const isMyTurn = () => session.state.activePlayerId === session.state.you;

/** Sort selectionne dans la main, ou null (aucune carte, ou carte d'unite). */
export function selectedSpell() {
  const hand = session.selectedHand;
  return hand && hand.card.type === "spell" ? hand.card : null;
}

// Rafraichissement de l'affichage : les modules d'affichage s'enregistrent
// ici (voir game/index.js), ce qui evite les dependances circulaires entre
// le plateau, la main et les panneaux.
const renderers = { board: () => {}, hand: () => {} };

export function setRenderers({ board, hand }) {
  renderers.board = board;
  renderers.hand = hand;
}

/** Redessine le plateau et les panneaux d'information. */
export const refreshBoard = () => renderers.board();
/** Redessine la main du joueur. */
export const refreshHand = () => renderers.hand();
