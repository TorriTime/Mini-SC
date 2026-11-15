// Decks joues par l'IA (voir game/ai/). Un deck est tire au hasard pour
// chaque adversaire IA ; meme format que les decks des joueurs.
// Les sorts "Piege" et "Jet d'eau" n'y figurent pas : l'IA n'en tire pas parti.

module.exports = [
  {
    name: "Garde stellaire",
    championId: "kael",
    cardIds: [
      "worker", "worker", "soldier", "soldier", "militia", "militia", "guardian", "guardian",
      "tank", "healer", "knight", "knight", "celestial_core", "juggernaut", "heal", "strike"
    ]
  },
  {
    name: "Assaut eclair",
    championId: "vex",
    cardIds: [
      "worker", "worker", "scout", "scout", "taunt_goblin", "taunt_goblin", "militia", "soldier",
      "knight", "knight", "berserker", "berserker", "dynamiter", "strike", "strike", "draw"
    ]
  },
  {
    name: "Ligne de tir",
    championId: "kira",
    cardIds: [
      "worker", "worker", "militia", "militia", "archer", "archer", "guardian", "guardian",
      "dynamiter", "dynamiter", "healer", "tank", "soldier", "strike", "heal", "draw"
    ]
  }
];
