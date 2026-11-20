/* Sol — Moine radieux. Renforce l'équipe, conclut les combos en se soignant. */
SC.defineCharacter({
  id: 'sol', name: 'Sol', title: 'Moine Radieux', role: 'Moine', element: 'light',
  look: { color: '#ffe68a', accent: '#ffffff', parts: ['halo', 'staff'] },
  stats: { hp: 950, atk: 95, def: 65, spd: 75, crit: 0.10 },
  normal: {
    id: 'sol-staff', name: 'Coup de bâton', desc: 'Un balayage de bâton (35 % de projeter au sol).',
    anim: 'slash', vfx: { impact: 'punch' },
    hits: [{ power: 1.0, state: 'LOW', stateChance: 0.35 }],
  },
  special: {
    id: 'sol-bless', name: 'Bénédiction Solaire', cost: 30, cooldown: 4,
    desc: 'Soigne légèrement l\'équipe et augmente son ATK de 25 % (3 tours).',
    target: 'allies', move: 'none', anim: 'cast',
    vfx: { cast: 'charge', impact: 'heal' },
    hits: [{ heal: 0.8, buffs: [{ id: 'atkUp', duration: 3 }] }],
  },
  pursuits: [{
    id: 'sol-purify', name: 'Éclat Purificateur', triggers: ['DOWN'],
    desc: 'Frappe un ennemi à terre et se soigne de 50 % des dégâts.',
    anim: 'slam', vfx: { impact: 'light-ray' },
    hits: [{ power: 0.8, lifesteal: 0.5 }],
  }],
  passives: [{
    id: 'serene', name: 'Aura Sereine', desc: 'Récupère 3 % de ses PV max au début de son tour.',
    onTurnStart: (battle, unit) => battle.heal(unit, unit.maxHp * 0.03, unit),
  }],
});
