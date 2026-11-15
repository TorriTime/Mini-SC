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

/** A appeler a chaque nouvel etat recu du serveur : abandonne ce qui, dans la
 * selection, n'est plus possible (tour passe a un autre joueur, unite
 * detruite ou devenue invisible, carte qui a quitte la main). Sans cela les
 * surbrillances d'une action devenue impossible resteraient affichees. */
export function pruneSelection() {
  const { state } = session;
  const onBoard = id => !!state.units[id] && state.units[id].health > 0;
  const inHand = instanceId => (myPlayer().hand || []).some(c => c.instanceId === instanceId);

  if (session.selectedUnitId && !onBoard(session.selectedUnitId)) session.selectedUnitId = null;
  if (session.inspectedEnemyId && !onBoard(session.inspectedEnemyId)) session.inspectedEnemyId = null;
  if (session.selectedHand && !(isMyTurn() && inHand(session.selectedHand.instanceId))) session.selectedHand = null;
  // Deplacement et competence armee : uniquement pour MON unite, pendant MON tour.
  if (!isMyTurn() || !session.selectedUnitId) {
    session.reachableCells = [];
    session.armedAbility = null;
  }
}

// Rafraichissement de l'affichage : les modules d'affichage s'enregistrent
// ici (voir game/index.js), ce qui evite les dependances circulaires entre
// le plateau, la main et les panneaux.
const renderers = { board: () => {}, hand: () => {} };

export function setRenderers({ board, hand }) {
  renderers.board = board;
  renderers.hand = hand;
}

/** Redessine le plateau et les panneaux d'information (ex : etape d'animation). */
export const refreshBoard = () => renderers.board();

/** A appeler apres TOUT changement de selection : redessine le plateau, les
 * panneaux et la main, pour que les surbrillances correspondent toujours a
 * la selection reelle -- y compris quand une action vient d'etre envoyee au
 * serveur et qu'il la refuse (aucun nouvel etat ne viendra alors redessiner). */
export function refreshSelection() {
  renderers.board();
  renderers.hand();
}
