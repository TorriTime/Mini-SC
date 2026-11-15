// Niveaux de difficulte de l'IA. Tous utilisent le meme raisonnement
// (voir index.js) ; seuls ces reglages changent.
//
//   noise        hasard ajoute a la note de chaque action (0 = toujours la meilleure)
//   blunder      probabilite d'ignorer une action possible (l'IA "ne la voit pas")
//   stopChance   probabilite, a chaque action, de terminer son tour trop tot
//   potential    poids des attaques encore possibles ce tour (se placer a portee)
//   threat       poids du danger que courent ses unites au tour adverse (prudence)
//   lookahead    simule aussi l'attaque qui suit un deplacement ou un deploiement
//   maxActions   garde-fou : nombre maximum d'actions par tour
//   weights      poids de la note de position a remplacer (voir evaluate.js)
//   plans        anticipation : styles de jeu essayes pour le tour entier ; l'IA
//                garde celui qui tient le mieux face a la riposte adverse
//   reply        reglages pretes a l'adversaire pour simuler cette riposte

const LEVELS = {
  easy: {
    label: "Facile",
    noise: 45, blunder: 0.35, stopChance: 0.12,
    potential: 0, threat: 0, lookahead: false, maxActions: 12
  },
  normal: {
    label: "Normal",
    noise: 5, blunder: 0, stopChance: 0,
    potential: 0.5, threat: 0.15, lookahead: false, maxActions: 30
  },
  hard: {
    label: "Difficile",
    noise: 0, blunder: 0, stopChance: 0,
    potential: 0.5, threat: 0.4, lookahead: true, maxActions: 40,
    plans: [
      {},                                                                    // equilibre
      { threat: 0.1, weights: { approachFoe: 2.5, approachChampion: 1.6 } }, // offensif
      { threat: 0.9, weights: { ownChampionBonus: 1.5 } },                   // defensif
      { weights: { mine: 90, settlingWorker: 60, workerStep: 5 } }           // economie
    ],
    reply: { noise: 0, blunder: 0, stopChance: 0, potential: 0.5, threat: 0, lookahead: false, maxActions: 25 }
  }
};

const isLevel = level => Object.prototype.hasOwnProperty.call(LEVELS, level);

module.exports = { LEVELS, isLevel };
