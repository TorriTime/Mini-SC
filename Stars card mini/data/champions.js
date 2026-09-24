// Champions disponibles (2 pour le prototype).
// Un champion est une unite speciale : beaucoup plus de PV, une
// competence active (voir data/abilities.js) et un passif simple.
//
// passive.type gere par la logique de jeu (game/gameState.js / game/combat.js) :
//   "regen"              -> recupere passive.amount PV au debut de son propre tour
//   "frenzy"             -> inflige +passive.amount degats en attaque quand son
//                            PV est <= 50% de son PV max
//   "alternate_movement" -> ne peut se deplacer qu'un tour sur deux (voir
//                            beginTurnSideEffects dans game/gameState.js) ;
//                            le compteur se base sur les tours DU PROPRIETAIRE,
//                            pas sur le nombre total de tours de la partie.
//                            N'affecte jamais l'attaque ni les competences.

module.exports = [
  {
    id: "kael",
    name: "Kael, Gardien Stellaire",
    attack: 30,
    health: 240,
    movement: 2,
    range: 1,
    description: "Champion equilibre qui se regenere au fil du combat.",
    abilities: ["heroic_strike"],
    passive: {
      id: "regen",
      type: "regen",
      amount: 9,
      name: "Regeneration",
      description: "Recupere 9 PV au debut de chacun de ses tours."
    }
  },
  {
    id: "vex",
    name: "Vex, la Lame Rapide",
    attack: 45,
    health: 130,
    movement: 2,
    range: 2,
    description: "Champion offensif, plus dangereux lorsqu'il est affaibli.",
    abilities: ["piercing_shot_vex"],
    passive: {
      id: "frenzy",
      type: "frenzy",
      amount: 10,
      name: "Frenesie",
      description: "Inflige 10 degats supplementaires quand ses PV sont a 50% ou moins."
    }
  },
  {
    id: "kira",
    name: "Kira, l'Oeil de Faucon",
    attack: 55,
    health: 150,
    movement: 2,
    range: 5,
    description: "Championne sniper a la portee redoutable, mais qui doit se stabiliser un tour sur deux pour viser.",
    abilities: ["piercing_shot_kira"],
    passive: {
      id: "alternate_movement",
      type: "alternate_movement",
      name: "Immobilite tactique",
      description: "Ne peut se deplacer qu'un tour sur deux (peut toujours attaquer et utiliser ses competences les tours ou elle est immobile)."
    }
  }
];
