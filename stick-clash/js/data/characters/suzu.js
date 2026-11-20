/* Suzu — Tireuse de foudre. Attaque à distance, projette bas. */
SC.defineCharacter({
  id: 'suzu', name: 'Suzu', title: 'Éclair d\'Argent', role: 'Tireuse', element: 'lightning',
  look: { color: '#ffe14a', accent: '#ffffff', parts: ['hair-pony', 'bow'] },
  stats: { hp: 700, atk: 110, def: 35, spd: 100, crit: 0.15 },
  normal: {
    id: 'suzu-shot', name: 'Tir éclair', desc: 'Une flèche chargée de foudre.',
    move: 'ranged', anim: 'shoot', vfx: { travel: 'arrow', impact: 'punch' },
    hits: [{ power: 1.0 }],
  },
  special: {
    id: 'suzu-rain', name: 'Pluie de Kunaï', cost: 40, cooldown: 3,
    desc: 'Une volée de kunaï sur tous les ennemis (dégâts seulement).',
    target: 'enemies', move: 'ranged', anim: 'shoot',
    vfx: { cast: 'lightning-charge', travel: 'arrow', impact: 'slash' },
    hits: [{ power: 0.7 }],
  },
  pursuits: [{
    id: 'suzu-graze', name: 'Tir Rasant', triggers: ['PUSH'],
    desc: 'Tire sur un ennemi repoussé et le plaque au sol.',
    move: 'ranged', anim: 'shoot', vfx: { travel: 'arrow', impact: 'bolt-strike' },
    hits: [{ power: 0.75, state: 'LOW' }],
  }],
  passives: [{
    id: 'sniper', name: 'Tireuse d\'élite', desc: '+15 % de dégâts sur les cibles sous un état.',
    damageDealt: (u, ctx) => (ctx.target.state ? 1.15 : 1),
  }],
});
