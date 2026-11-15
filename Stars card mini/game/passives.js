// Passifs de champion (voir data/champions.js, champ `passive`). Chaque type
// de passif declare ici a quels moments du jeu il intervient :
//   onTurnStart(unit, passive) -> debut de chaque tour du PROPRIETAIRE
//   attackBonus(unit, passive) -> bonus ajoute a l'attaque (game/combat.js)
//   onRespawn(unit, passive)   -> reapparition en mode bac a sable

const PASSIVES = {
  regen: {
    onTurnStart(unit, passive) {
      unit.health = Math.min(unit.maxHealth, unit.health + passive.amount);
    }
  },

  frenzy: {
    attackBonus(unit, passive) {
      return unit.health <= unit.maxHealth * 0.5 ? passive.amount : 0;
    }
  },

  alternate_movement: {
    // Un tour sur deux, base UNIQUEMENT sur les tours du proprietaire (jamais
    // sur les tours des autres joueurs) : n'affecte que le deplacement,
    // jamais l'attaque ni les competences.
    onTurnStart(unit) {
      unit.canMoveThisTurn = !unit.canMoveThisTurn;
      unit.movement = unit.canMoveThisTurn ? unit.baseMovement : 0;
    },
    // Etat remis a "mobile" de facon coherente a la reapparition, plutot que
    // de rester bloque sur l'etat qu'il avait au moment de sa mort.
    onRespawn(unit) {
      unit.canMoveThisTurn = true;
      unit.movement = unit.baseMovement;
    }
  }
};

function hookOf(unit, hookName) {
  const handlers = unit.passive && PASSIVES[unit.passive.type];
  return handlers && handlers[hookName];
}

function onTurnStart(unit) {
  const hook = hookOf(unit, "onTurnStart");
  if (hook) hook(unit, unit.passive);
}

function onRespawn(unit) {
  const hook = hookOf(unit, "onRespawn");
  if (hook) hook(unit, unit.passive);
}

function attackBonus(unit) {
  const hook = hookOf(unit, "attackBonus");
  return hook ? hook(unit, unit.passive) : 0;
}

module.exports = { onTurnStart, onRespawn, attackBonus };
