/* ============================================================
 * Effets durables (buffs / debuffs).
 *
 *  stats        : multiplicateurs de statistiques { atk: 1.25 }
 *  damageTaken  : multiplicateur (ou fonction) sur les dégâts reçus
 *  damageDealt  : idem sur les dégâts infligés
 *  onTurnStart  : async (battle, unit, buff) — appelé au début du tour du porteur
 *
 * La durée est décrémentée au début de chaque tour du porteur
 * (après onTurnStart) : durée 2 = effet sur 2 tours du porteur.
 * ============================================================ */
(function (root) {
  'use strict';
  const SC = root.SC;

  SC.buffs.register({
    id: 'burn', name: 'Brûlure', short: 'Br', color: '#ff7a33', debuff: true,
    desc: 'Perd 5 % des PV max au début de son tour.',
    onTurnStart: (battle, unit, buff) => battle.dot(unit, Math.max(1, Math.round(unit.maxHp * 0.05)), buff),
  });

  SC.buffs.register({
    id: 'poison', name: 'Poison', short: 'Po', color: '#8bdc4a', debuff: true,
    desc: 'Perd 6 % des PV max au début de son tour.',
    onTurnStart: (battle, unit, buff) => battle.dot(unit, Math.max(1, Math.round(unit.maxHp * 0.06)), buff),
  });

  SC.buffs.register({
    id: 'guard', name: 'Garde', short: 'Ga', color: '#9fc2ff',
    desc: 'Dégâts subis −35 %.',
    damageTaken: 0.65,
  });

  SC.buffs.register({
    id: 'atkUp', name: 'Rage', short: 'At', color: '#ffb347',
    desc: 'Attaque +25 %.',
    stats: { atk: 1.25 },
  });

  SC.buffs.register({
    id: 'weak', name: 'Affaibli', short: 'Fa', color: '#b08cff', debuff: true,
    desc: 'Attaque −20 %.',
    stats: { atk: 0.8 },
  });
})(typeof window !== 'undefined' ? window : globalThis);
