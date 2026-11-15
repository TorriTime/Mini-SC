// Systeme generique de limitation du nombre d'utilisations d'une carte ou
// d'une competence, applique reellement dans le moteur de jeu (l'affichage
// des utilisations restantes est fait cote client). Notation du cahier des charges :
//   "NU"    -> { total: N }            N utilisations max pour toute la partie
//   "NU/T"  -> { perTurn: N }          N utilisations max par tour
// Les deux peuvent etre combinees et sont alors verifiees simultanement.
//
// Le compteur est stocke directement sur son "porteur" :
//   - une unite pour ses competences (unit.abilityUses[abilityId])
//   - un joueur pour ses sorts/cartes (player.cardUses[cardId])
// Ne pas confondre ce compteur avec le nombre d'exemplaires d'une carte
// dans le deck : ici on compte des UTILISATIONS, pas des cartes en pioche.

function ensureCounter(store, key) {
  if (!store[key]) store[key] = { total: 0, thisTurn: 0 };
  return store[key];
}

function canUse(store, key, usesLimit) {
  if (!usesLimit) return true;
  const c = store[key] || { total: 0, thisTurn: 0 };
  if (usesLimit.total != null && c.total >= usesLimit.total) return false;
  if (usesLimit.perTurn != null && c.thisTurn >= usesLimit.perTurn) return false;
  return true;
}

function recordUse(store, key) {
  const c = ensureCounter(store, key);
  c.total += 1;
  c.thisTurn += 1;
}

/** A appeler au debut du tour du proprietaire du store (joueur ou unite). */
function resetTurnCounters(store) {
  for (const key of Object.keys(store)) {
    store[key].thisTurn = 0;
  }
}

module.exports = { canUse, recordUse, resetTurnCounters };
