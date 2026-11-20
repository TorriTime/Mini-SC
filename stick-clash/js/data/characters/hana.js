/* Hana — Soutien aquatique. Soigne, nettoie, relance les combos en projection haute. */
SC.defineCharacter({
  id: 'hana', name: 'Hana', title: 'Source Vive', role: 'Soutien', element: 'water',
  look: { color: '#5cc2ff', accent: '#d4f0ff', parts: ['hair-long', 'orb'] },
  stats: { hp: 820, atk: 88, def: 45, spd: 95, crit: 0.08 },
  normal: {
    id: 'hana-jet', name: 'Jet d\'eau', desc: 'Un jet d\'eau comprimé (40 % de plaquer au sol).',
    move: 'ranged', anim: 'cast', vfx: { travel: 'orb', impact: 'punch' },
    hits: [{ power: 0.9, state: 'LOW', stateChance: 0.4 }],
  },
  special: {
    id: 'hana-mist', name: 'Brume Curative', cost: 35, cooldown: 3,
    desc: 'Soigne toute l\'équipe et retire les effets négatifs.',
    target: 'allies', move: 'none', anim: 'cast',
    vfx: { cast: 'heal-aura', impact: 'heal' },
    hits: [{ heal: 2.2, cleanse: true }],
  },
  pursuits: [{
    id: 'hana-geyser', name: 'Geyser', triggers: ['LOW', 'DOWN'],
    desc: 'Un geyser jaillit sous l\'ennemi au sol ou à terre et le projette en l\'air.',
    move: 'ranged', anim: 'cast', vfx: { impact: 'geyser' },
    hits: [{ power: 0.6, state: 'HIGH' }],
  }],
  passives: [{
    id: 'tide', name: 'Marée', desc: 'Au début de son tour, +10 chakra à l\'allié qui en a le moins.',
    onTurnStart: async (battle, unit) => {
      const others = battle.alliesOf(unit).filter(a => a !== unit).sort((a, b) => a.chakra - b.chakra);
      if (others.length) await battle.addChakra(others[0], 10);
    },
  }],
});
