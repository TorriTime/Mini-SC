// Competences (skills) utilisables par les unites et les champions.
// Systeme generique et volontairement simple : chaque competence a un
// cout en mana, une portee d'utilisation et UN effet parmi une petite
// liste de types geres par game/abilities.js
//
// Types d'effets geres :
//   damage       -> inflige des degats a une cible
//   heal         -> soigne une cible (allie)
//   move         -> deplace l'unite d'un nombre de cases supplementaire
//   buff_attack  -> augmente temporairement l'attaque d'une cible
//   buff_defense -> augmente temporairement la defense (reduction degats) d'une cible
//   none         -> pas d'effet a l'activation (competence PASSIVE, voir `passive`)
//
// Drapeaux speciaux geres directement par game/gameState.js (routage avant
// applyAbilityEffect, car leur resolution sort du cadre "1 effet generique") :
//   isCharge   -> deplacement reel vers la cible (ligne de vue + chemin valide)
//                 puis attaque normale (degats de zone/riposte inclus).
//   isPiercing -> Perforation : touche toutes les unites ENNEMIES alignees
//                 sur la ligne de tir entre l'attaquant et la cible.
//   passive    -> jamais activable via useAbility ; effet permanent gere
//                 ailleurs (ex : Provocation dans attackUnit/useAbility).
//
// `uses` (optionnel) limite le nombre d'utilisations, applique cote moteur
// par game/gameState.js (voir game/usage.js) :
//   { total: N }          -> "NU"   : N utilisations max pour TOUTE la partie
//   { perTurn: N }        -> "NU/T" : N utilisations max PAR TOUR (proprietaire)
//   { total: N, perTurn: M } -> les deux limites s'appliquent simultanement
//
// IMPORTANT -- une entree par HEROS, jamais partagee : gameState.js resout
// une competence via `abilitiesById[abilityId]`, donc deux champions qui
// referencent le MEME id pointent vers le MEME objet (memes degats/portee/
// cout) et on ne peut plus les equilibrer separement. Meme quand deux
// heros utilisent le meme effet generique (ex : Perforation), chacun doit
// avoir sa PROPRE entree avec un id unique (suffixe par le nom du heros) :
// modifier l'une ne doit jamais modifier l'autre.

module.exports = {
  charge: {
    id: "charge",
    name: "Charge",
    cost: 2,
    range: 1, // portee d'ATTAQUE une fois arrivee (le trajet utilise le deplacement normal de l'unite)
    targetType: "enemy",
    isCharge: true,
    description: "Fonce vers une unite ennemie ciblee en suivant un chemin valide (impossible si une unite bloque le chemin direct), puis effectue son attaque normale avec tous ses effets (degats de zone, riposte...).",
    effect: { type: "damage", amount: 0 } // non utilise : resolveCharge applique une vraie attaque
  },
  heal: {
    id: "heal",
    name: "Soin",
    cost: 2,
    range: 2,
    targetType: "ally",
    description: "Soigne une unite alliee de 20 PV. (2 utilisations max par tour)",
    effect: { type: "heal", amount: 20 },
    uses: { perTurn: 2 }
  },
  shield_wall: {
    id: "shield_wall",
    name: "Mur de boucliers",
    cost: 2,
    range: 0,
    targetType: "self",
    description: "Augmente sa propre defense de 10 pendant 2 tours.",
    effect: { type: "buff_defense", amount: 10, duration: 2 }
  },
  battle_cry: {
    id: "battle_cry",
    name: "Cri de guerre",
    cost: 3,
    range: 0,
    targetType: "self",
    description: "Augmente sa propre attaque de 15 pendant 2 tours.",
    effect: { type: "buff_attack", amount: 15, duration: 2 }
  },
  heroic_strike: {
    id: "heroic_strike",
    name: "Frappe heroique",
    cost: 3,
    range: 1,
    targetType: "enemy",
    description: "Attaque puissante infligeant 50 degats.",
    effect: { type: "damage", amount: 50 }
  },
  // Perforation de Vex -- entree independante de celle de Kira (voir note
  // en tete de fichier) : modifier l'une n'affecte jamais l'autre.
  piercing_shot_vex: {
    id: "piercing_shot_vex",
    name: "Perforation",
    cost: 3,
    range: 4,
    targetType: "enemy",
    isPiercing: true,
    description: "Tir perforant infligeant 25 degats a TOUTES les unites ennemies alignees sur la ligne de tir entre le tireur et la cible (les allies sur la trajectoire ne sont pas touches).",
    effect: { type: "damage", amount: 25 }
  },
  // Perforation de Kira -- entree independante de celle de Vex.
  piercing_shot_kira: {
    id: "piercing_shot_kira",
    name: "Perforation",
    cost: 3,
    range: 4,
    targetType: "enemy",
    isPiercing: true,
    description: "Tir perforant infligeant 25 degats a TOUTES les unites ennemies alignees sur la ligne de tir entre le tireur et la cible (les allies sur la trajectoire ne sont pas touches).",
    effect: { type: "damage", amount: 25 }
  },
  camouflage: {
    id: "camouflage",
    name: "Camouflage",
    cost: 2,
    range: 0,
    targetType: "self",
    description: "Devient invisible pour les adversaires pendant 2 tours (reste visible pour son proprietaire). Attaquer ou utiliser une competence contre un ennemi revele immediatement l'unite.",
    effect: { type: "invisible", duration: 2 }
  },
  provocation: {
    id: "provocation",
    name: "Provocation",
    cost: 0,
    range: 0,
    targetType: "self",
    passive: true,
    description: "Passif : les ennemis a portee de cette unite doivent la cibler en priorite s'ils decident d'attaquer (n'oblige pas a attaquer). S'applique aux attaques normales, a la Charge et a Perforation, pas aux sorts.",
    effect: { type: "none" }
  }
};
