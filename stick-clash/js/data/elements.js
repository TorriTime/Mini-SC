/* Éléments : palette utilisée par les VFX et l'interface. Ajouter un élément = une ligne. */
(function (root) {
  'use strict';
  const SC = root.SC;
  const E = (id, name, main, light, dark) => SC.elements.register({ id, name, main, light, dark });

  E('neutral',   'Neutre',   '#e8e8f0', '#ffffff', '#8a8aa0');
  E('fire',      'Feu',      '#ff6a3d', '#ffd36b', '#a52a00');
  E('wind',      'Vent',     '#6ee7b7', '#e0fff4', '#1d9a73');
  E('earth',     'Terre',    '#c99a5b', '#f2dcae', '#6b4a22');
  E('lightning', 'Foudre',   '#ffe14a', '#ffffff', '#b58a00');
  E('water',     'Eau',      '#4ab8ff', '#d4f0ff', '#1b6aa8');
  E('light',     'Lumière',  '#fff2a8', '#ffffff', '#d4a51c');
  E('shadow',    'Ombre',    '#a56bff', '#e2ccff', '#4a1f8a');
  E('star',      'Astre',    '#ff7bd5', '#ffd6f2', '#9a2a78');
})(typeof window !== 'undefined' ? window : globalThis);
