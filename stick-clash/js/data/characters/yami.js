/* Yami — Ombre furtive. Empoisonne, affaiblit, exécute les cibles blessées. */
SC.defineCharacter({
  id: 'yami', name: 'Yami', title: 'Ombre Furtive', role: 'Ombre', element: 'shadow',
  look: { color: '#b98aff', accent: '#e2ccff', parts: ['hood', 'scarf', 'kunai'] },
  stats: { hp: 760, atk: 105, def: 45, spd: 110, crit: 0.15 },
  normal: {
    id: 'yami-blade', name: 'Lame d\'ombre', desc: 'Entaille rapide (25 % d\'affaiblir).',
    approach: 'blink', anim: 'slash', vfx: { impact: 'slash' },
    hits: [{ power: 1.0, buffs: [{ id: 'weak', duration: 2, chance: 0.25 }] }],
  },
  special: {
    id: 'yami-embrace', name: 'Étreinte Noire', cost: 40, cooldown: 3,
    desc: 'Frappe, plaque au sol, empoisonne et affaiblit.',
    approach: 'blink', anim: 'slash2', vfx: { cast: 'shadow-aura', impact: 'shadow-spikes' },
    hits: [{
      power: 1.0, state: 'LOW',
      buffs: [{ id: 'poison', duration: 3 }, { id: 'weak', duration: 2 }],
    }],
  },
  pursuits: [{
    id: 'yami-bind', name: 'Entraves d\'Ombre', triggers: ['LOW'],
    desc: 'Cloue un ennemi au sol (Chute) et l\'affaiblit.',
    approach: 'blink', anim: 'kick', vfx: { impact: 'shadow-spikes' },
    hits: [{ power: 0.55, state: 'DOWN', buffs: [{ id: 'weak', duration: 2 }] }],
  }],
  passives: [{
    id: 'assassin', name: 'Exécution', desc: '+30 % de dégâts sur les cibles sous 40 % de PV.',
    damageDealt: (u, ctx) => (ctx.target.hp < ctx.target.maxHp * 0.4 ? 1.3 : 1),
  }],
});
