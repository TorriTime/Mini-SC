/* ============================================================
 * Règles globales et disposition de l'arène.
 * Tout l'équilibrage « système » se règle ici.
 * ============================================================ */
(function (root) {
  'use strict';
  const SC = root.SC;

  SC.rules = {
    teamSize: 4,

    // Chakra
    maxChakra: 100,
    startChakra: 20,
    chakraPerTurn: 20,     // gagné au début de chaque tour du personnage
    chakraOnNormal: 10,    // bonus quand on utilise l'attaque normale
    chakraOnHurt: 5,       // bonus quand on subit des dégâts

    // Dégâts
    damageScale: 1.7,      // coefficient global (règle la durée des combats)
    defenseConstant: 100,  // réduction = 100 / (100 + DEF)
    critMultiplier: 1.5,
    damageVariance: 0.06,  // ±6 %

    // Combos : multiplicateur de dégâts selon le rang de l'action dans la chaîne
    comboScaling: [1, 1, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7],
    maxChainLength: 8,     // action initiale + poursuites

    // Formation : multiplicateur de dégâts subis par emplacement (0 = ligne de front)
    slotDamageTaken: [1.1, 1, 1, 0.9],

    maxRounds: 40,
  };

  // Emplacements (x, y) de l'équipe A (à gauche, regarde vers la droite).
  // L'équipe B est le miroir exact. L'emplacement 0 est en première ligne.
  const A = [[545, 414], [455, 350], [405, 478], [290, 414]];
  SC.layout = {
    width: 1280,
    height: 620,
    horizon: 300,
    slots: {
      A: A,
      B: A.map(([x, y]) => [1280 - x, y]),
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
