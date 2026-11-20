/* Point d'entrée : bascule entre le menu et le combat. */
(function (root) {
  'use strict';
  const SC = root.SC;

  const boot = () => {
    const menuEl = document.getElementById('menu');
    const battleEl = document.getElementById('battle');
    let menu = null, ui = null;

    const show = which => {
      menuEl.classList.toggle('hidden', which !== 'menu');
      battleEl.classList.toggle('hidden', which !== 'battle');
    };

    const showMenu = () => {
      show('menu');
      if (!menu) menu = new SC.Menu(menuEl, { onStart: startBattle });
      else menu.render();
    };

    const startBattle = (teamA, teamB, mode) => {
      show('battle');
      ui = new SC.BattleUI(battleEl, { onQuit: showMenu });
      SC.ui = ui; // pratique pour déboguer dans la console
      ui.run(teamA, teamB, mode);
    };

    showMenu();
  };
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
