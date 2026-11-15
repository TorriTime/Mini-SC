// Constantes de regles du jeu, partagees par tous les modules de game/.
// Les donnees de cartes/champions/competences vivent a part dans data/.

module.exports = {
  STARTING_HAND: 5,
  MAX_MANA: 10,          // limite de mana maximale (cout max d'une carte)
  QUARTERS_PER_MANA: 4,  // 4 quarts de mana (1 par mine et par tour) = +1 de limite definitive
  MINE_RADIUS: 1,        // une mine est la zone de rayon 1 autour de sa case centrale
  SAFE_RADIUS: 2,        // zone sure autour d'une mine controlee
  SAFE_MIN_MOVEMENT: 2,  // deplacement minimal des unites dans une zone sure
  TOWER_HEALTH: 50,
  MIN_DECK_SIZE: 10,
  MAX_PLAYER_NAME_LENGTH: 16, // comme le champ de saisie du pseudo cote client
  MAX_DECK_NAME_LENGTH: 40,
  GAME_CODE_LENGTH: 5,
  LOG_HISTORY: 50,       // messages conserves dans l'etat serveur
  LOG_SENT: 15           // derniers messages envoyes a chaque client
};
