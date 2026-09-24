// Historique des versions affiche dans l'onglet "Patch notes" du menu
// principal. Purement informatif (pas de progression/achats/mise a jour
// automatique) -- voir public/client.js pour l'affichage.
//
// Pour ajouter une entree : pousser un nouvel objet EN TETE du tableau
// (ordre decroissant, la version la plus recente en premier).
// { version: "x.y", title: "...", changes: ["...", "..."] }

module.exports = [
  {
    version: "0.4",
    title: "Correctifs multijoueur, decks sauvegardes et competences",
    changes: [
      "Correction du plateau trop zoome pour les joueurs 3 et 4 en partie a 4.",
      "Correction du bug qui bloquait le joueur heritant du tour apres une elimination.",
      "Ajout de cet onglet Patch Notes.",
      "Plusieurs decks nommes et sauvegardables, choisis independamment par chaque joueur au lancement d'une partie.",
      "Infobulles affichant les descriptions completes des competences (deckbuilder, main, plateau, Champions).",
      "Rework de la Charge : deplacement reel vers la cible avec verification de ligne de vue.",
      "Nouvelle competence Provocation.",
      "Tir perforant devient Perforation : touche toutes les unites ennemies alignees sur la ligne de tir.",
      "Nouveau Champion : le Sniper, tres longue portee mais ne se deplacant qu'un tour sur deux."
    ]
  },
  {
    version: "0.3",
    title: "Options de partie, Dynamiteur et 4 joueurs",
    changes: [
      "Ecran de configuration de partie : riposte, remelange de la defausse, limite de main, chronometre, mode bac a sable.",
      "Systeme generique de limitation d'utilisations (NU / NU par tour), applique au Guerisseur.",
      "Nouvelle unite : le Dynamiteur, avec degats de zone.",
      "Multijoueur jusqu'a 4 joueurs sur un plateau agrandi, avec perspective adaptee a chaque siege.",
      "Bouton Abandonner avec double confirmation.",
      "Filtres et tri dans le deckbuilder (cout, type, classe, race, objectif).",
      "Bouton Copier pour le code de partie.",
      "Correction du deck reellement utilise en partie, de la pioche a vide et du salon d'attente apres deconnexion."
    ]
  },
  {
    version: "0.2",
    title: "Sorts et interface repensee",
    changes: [
      "Premiers sorts jouables : Soin, Frappe, Ravitaillement.",
      "Plateau hexagonal agrandi, compact et carre.",
      "Rotation du plateau pour que chaque joueur voie son Champion en bas de son ecran.",
      "Panneaux d'informations dedies (mes unites a gauche, unites adverses a droite).",
      "Main portee a 5 cartes."
    ]
  },
  {
    version: "0.1",
    title: "Premiere version jouable",
    changes: [
      "Plateau hexagonal et deplacement au tour par tour.",
      "Systeme de deck et de Champion.",
      "Combat de base (attaque, portee, competences).",
      "Multijoueur a 2 joueurs via code de partie."
    ]
  }
];
