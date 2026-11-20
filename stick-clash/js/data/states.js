/* ============================================================
 * États de contrôle : ce sont eux qui déclenchent les poursuites.
 * (L'aspect visuel de chaque état est dans render/statevisuals.js.)
 * Ajouter un état = une entrée ici + une entrée dans statevisuals.js.
 * ============================================================ */
(function (root) {
  'use strict';
  const SC = root.SC;
  const S = (id, name, short, color) => SC.states.register({ id, name, short, color });

  S('HIGH', 'Projection haute',  'HAUTE',     '#ffd24a');
  S('LOW',  'Projection basse',  'BASSE',     '#ff8a3d');
  S('PUSH', 'Repoussement',      'REPOUSSÉ',  '#4ad0ff');
  S('DOWN', 'Chute',             'CHUTE',     '#c27bff');
})(typeof window !== 'undefined' ? window : globalThis);
