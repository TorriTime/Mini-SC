// Sorts jouables depuis la main (cartes sans unite associee).
// Meme systeme de donnees que les cartes d'unite (data/cards.js) : totalement
// separe de la logique de jeu (voir game/spells.js).
//
// Schema d'un sort :
// {
//   id, name, type: "spell", cost, targetType, description,
//   effect: { type: "damage"|"heal"|"draw", amount }
// }
//
// targetType : "ally" (unite alliee a cibler), "enemy" (unite ennemie a
// cibler) ou "none" (aucune cible, effet immediat).

module.exports = [
  {
    id: "heal",
    name: "Soin",
    type: "spell",
    cost: 2,
    targetType: "ally",
    description: "Rend 30 PV a une unite alliee.",
    effect: { type: "heal", amount: 30 }
  },
  {
    id: "strike",
    name: "Frappe",
    type: "spell",
    cost: 3,
    targetType: "enemy",
    description: "Inflige 45 degats a une unite ennemie.",
    effect: { type: "damage", amount: 45 }
  },
  {
    id: "draw",
    name: "Ravitaillement",
    type: "spell",
    cost: 1,
    targetType: "none",
    description: "Pioche 2 carte.",
    effect: { type: "draw", amount: 2 }
  },
  {
    id: "water_jet",
    name: "Jet d'eau",
    type: "spell",
    cost: 2,
    targetType: "cell",
    description: "Transforme une case du plateau en boue. Toute unite s'y trouvant perd 1 point de deplacement (minimum 1), y compris les unites qui y arriveront plus tard. La boue est permanente et ne s'aggrave jamais si on la cible plusieurs fois.",
    effect: { type: "mud" }
  },
  {
    id: "trap",
    name: "Piege",
    type: "spell",
    cost: 2,
    targetType: "cell",
    description: "Pose un piege invisible sur une case du plateau. Seul son proprietaire peut le voir. Reste en place jusqu'a ce qu'une unite ennemie marche dessus (il se declenche alors et devient visible) ou jusqu'a la fin de la partie.",
    effect: { type: "trap" }
  }
];
