// Collection de cartes du prototype (~11 cartes).
// IMPORTANT : ces donnees sont totalement separees de la logique de jeu.
// Modifier une carte ici n'implique de toucher aucun fichier dans /game.
//
// Schema d'une carte :
// {
//   id, name, type: "unit", cost, attack, health, movement, range, description,
//   abilities: [abilityId,...],
//   class, race, role   -- metadonnees LIBRES utilisees par les filtres du
//                          deckbuilder (public/client.js). Absentes = non
//                          filtrable sur ce critere, jamais une erreur.
//   splash: { radius, percent } -- optionnel : degats de zone sur l'attaque
//                                   de base (voir game/combat.js).
//   isWorker: true -- optionnel : ouvrier, peut s'installer au centre d'une
//                     mine pour y creer une tour (voir game/gameState.js).
//   aura: { radius, damageReduction } -- optionnel : les troupes ALLIEES a
//                     `radius` (cette unite incluse) subissent
//                     `damageReduction` (0.15 = -15%) de degats en moins.
//                     Ne se cumule pas entre plusieurs sources.
// }
// Les sorts (cartes sans unite) vivent a part dans data/spells.js (type: "spell").

module.exports = [
  {
    id: "soldier",
    name: "Soldat",
    type: "unit",
    cost: 2,
    attack: 20,
    health: 55,
    movement: 2,
    range: 1,
    description: "Unite de base, equilibree.",
    abilities: [],
    class: "Guerrier",
    race: "Humain",
    role: "Mini tank"
  },
  {
    id: "scout",
    name: "Eclaireur",
    type: "unit",
    cost: 1,
    attack: 10,
    health: 25,
    movement: 3,
    range: 1,
    description: "Unite rapide, tres mobile mais fragile. Peut se rendre invisible pour se faufiler derriere les lignes ennemies.",
    abilities: ["camouflage"],
    class: "Roublard",
    race: "Humain",
    role: "Assassin"
  },
  {
    id: "archer",
    name: "Archer",
    type: "unit",
    cost: 3,
    attack: 25,
    health: 40,
    movement: 1,
    range: 2,
    description: "Attaque a distance, peu mobile.",
    abilities: [],
    class: "Chasseur",
    race: "Elfe",
    role: "Tireur"
  },
  {
    id: "tank",
    name: "Colosse",
    type: "unit",
    cost: 4,
    attack: 15,
    health: 120,
    movement: 1,
    range: 1,
    description: "Tres resistant, encaisse les coups.",
    abilities: [],
    class: "Guerrier",
    race: "Nain",
    role: "Tank"
  },
  {
    id: "berserker",
    name: "Berserker",
    type: "unit",
    cost: 4,
    attack: 55,
    health: 60,
    movement: 2,
    range: 1,
    description: "Grosse attaque, sante fragile.",
    abilities: [],
    class: "Guerrier",
    race: "Orc",
    role: "Assassin"
  },
  {
    id: "militia",
    name: "Milicien",
    type: "unit",
    cost: 1,
    attack: 12,
    health: 20,
    movement: 2,
    range: 2,
    description: "Unite faible mais tres peu couteuse.",
    abilities: [],
    class: "Guerrier",
    race: "Humain",
    role: "harceleur"
  },
  {
    id: "healer",
    name: "Guerisseur",
    type: "unit",
    cost: 3,
    attack: 8,
    health: 46,
    movement: 2,
    range: 2,
    description: "Soutient ses allies en les soignant (soin limite a 2 utilisations par tour).",
    abilities: ["heal"],
    class: "Mage",
    race: "Humain",
    role: "Soutien"
  },
  {
    id: "knight",
    name: "Chevalier",
    type: "unit",
    cost: 3,
    attack: 18,
    health: 70,
    movement: 3,
    range: 1,
    description: "Peut charger une cible pour l'achever.",
    abilities: ["charge"],
    class: "Guerrier",
    race: "Humain",
    role: "Mini tank"
  },
  {
    id: "guardian",
    name: "Gardien",
    type: "unit",
    cost: 3,
    attack: 10,
    health: 90,
    movement: 1,
    range: 1,
    description: "Peut se renforcer defensivement. Force les ennemis a portee a le cibler en priorite (Provocation).",
    abilities: ["shield_wall", "provocation"],
    class: "Guerrier",
    race: "Nain",
    role: "Tank"
  },
  {
    id: "juggernaut",
    name: "Juggernaut",
    type: "unit",
    cost: 6,
    attack: 35,
    health: 120,
    movement: 2,
    range: 1,
    description: "Peut pousser un cri de guerre pour frapper plus fort.",
    abilities: ["battle_cry"],
    class: "Guerrier",
    race: "Orc",
    role: "Tank"
  },
  {
    id: "worker",
    name: "Ouvrier",
    type: "unit",
    cost: 1,
    attack: 5,
    health: 30,
    movement: 2,
    range: 1,
    description: "S'installe au centre d'une mine et y reste un tour complet pour y construire une tour d'ouvrier et dominer la zone.",
    abilities: [],
    class: "Ingenieur",
    race: "Humain",
    role: "Ouvrier",
    isWorker: true
  },
  {
    id: "celestial_core",
    name: "Noyau celeste",
    type: "unit",
    cost: 4,
    attack: 0,
    health: 117,
    movement: 1,
    range: 0,
    description: "Dans une zone de 3, reduit de 15% les degats subis par toutes les troupes alliees (ne se cumule pas).",
    abilities: [],
    class: "Mage",
    race: "Celeste",
    role: "Soutien",
    aura: { radius: 3, damageReduction: 0.15 }
  },
  {
    id: "taunt_goblin",
    name: "Gobelin provocateur",
    type: "unit",
    cost: 1,
    attack: 40,
    health: 10,
    movement: 3,
    range: 1,
    description: "Tres fragile mais frappe fort. Force les ennemis a portee a le cibler en priorite (Provocation).",
    abilities: ["provocation"],
    class: "Roublard",
    race: "Gobelin",
    role: "Provocateur"
  },
  {
    id: "dynamiter",
    name: "Dynamiteur",
    type: "unit",
    cost: 4,
    attack: 30,
    health: 45,
    movement: 2,
    range: 2,
    description: "Degats de zone : les troupes a distance 1 de sa cible subissent 50% des degats infliges a la cible principale.",
    abilities: [],
    class: "Ingenieur",
    race: "Gobelin",
    role: "Degats de zone",
    splash: { radius: 1, percent: 0.5 }
  }
];
