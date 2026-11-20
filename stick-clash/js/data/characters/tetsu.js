/* Tetsu — Tank de terre. Repousse, encaisse, et conclut les combos (finisseur). */
SC.defineCharacter({
  id: 'tetsu', name: 'Tetsu', title: 'Rempart de Fer', role: 'Tank', element: 'earth',
  look: { color: '#d4a463', accent: '#f2dcae', parts: ['helmet', 'gloves'] },
  stats: { hp: 1150, atk: 85, def: 90, spd: 55, crit: 0.05 },
  normal: {
    id: 'tetsu-bash', name: 'Coup d\'épaule', desc: 'Un coup lourd (45 % de repousser).',
    anim: 'punch', vfx: { impact: 'quake' },
    hits: [{ power: 0.95, state: 'PUSH', stateChance: 0.45 }],
  },
  special: {
    id: 'tetsu-charge', name: 'Charge du Bélier', cost: 30, cooldown: 2,
    desc: 'Charge qui repousse l\'ennemi et protège Tetsu (Garde).',
    anim: 'punch', vfx: { cast: 'charge', impact: 'quake' },
    hits: [{ power: 1.2, state: 'PUSH', buffs: [{ id: 'guard', duration: 2, to: 'self' }] }],
  },
  pursuits: [{
    id: 'tetsu-crush', name: 'Écrasement Tellurique', triggers: ['DOWN', 'LOW'],
    desc: 'Finisseur : écrase un ennemi à terre (aucun nouvel état).',
    anim: 'slam', vfx: { impact: 'quake' },
    hits: [{ power: 1.3 }],
  }],
  passives: [{
    id: 'stone-skin', name: 'Peau de Pierre', desc: 'Dégâts subis −10 %.',
    damageTaken: () => 0.9,
  }],
});
