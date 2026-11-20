/* Kaze — Assassin du vent. Repousse toute l'équipe adverse : lanceur de combos. */
SC.defineCharacter({
  id: 'kaze', name: 'Kaze', title: 'Lame du Vent', role: 'Assassin', element: 'wind',
  look: { color: '#5eeaa8', accent: '#e0fff4', parts: ['scarf', 'mask', 'sword'] },
  stats: { hp: 740, atk: 100, def: 40, spd: 125, crit: 0.20 },
  normal: {
    id: 'kaze-slash', name: 'Double entaille', desc: 'Deux coups de lame rapides.',
    approach: 'blink', vfx: { impact: 'slash' },
    hits: [{ power: 0.55, anim: 'slash' }, { power: 0.55, anim: 'slash2' }],
  },
  special: {
    id: 'kaze-storm', name: 'Tempête de Lames', cost: 40, cooldown: 3,
    desc: 'Une lame de vent concentrée qui repousse un ennemi.',
    target: 'enemy', move: 'ranged', anim: 'cast',
    vfx: { cast: 'wind-swirl', travel: 'wave', impact: 'wind-cut' },
    hits: [{ power: 1.2, state: 'PUSH' }],
  },
  pursuits: [{
    id: 'kaze-flash', name: 'Fauchage Éclair', triggers: ['PUSH'],
    desc: 'Rattrape un ennemi repoussé et le projette en l\'air.',
    approach: 'blink', anim: 'kick', vfx: { impact: 'wind-cut' },
    hits: [{ power: 0.7, state: 'HIGH' }],
  }],
  passives: [{
    id: 'opportunist', name: 'Opportuniste', desc: '+25 % de dégâts sur ses poursuites.',
    damageDealt: (u, ctx) => (ctx.pursuit ? 1.25 : 1),
  }],
});
