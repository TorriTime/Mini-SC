/* Hoshi — Mage stellaire. Gros dégâts de zone ; relaie les projections hautes. */
SC.defineCharacter({
  id: 'hoshi', name: 'Hoshi', title: 'Mage Stellaire', role: 'Mage', element: 'star',
  look: { color: '#ff86da', accent: '#ffe0f5', parts: ['wizard-hat', 'orb'] },
  stats: { hp: 740, atk: 122, def: 32, spd: 90, crit: 0.10 },
  normal: {
    id: 'hoshi-spark', name: 'Éclat stellaire', desc: 'Un projectile d\'énergie stellaire (40 % de projeter en l\'air).',
    move: 'ranged', anim: 'cast', vfx: { travel: 'orb', impact: 'punch' },
    hits: [{ power: 1.0, state: 'HIGH', stateChance: 0.4 }],
  },
  special: {
    id: 'hoshi-rain', name: 'Pluie d\'Étoiles', cost: 50, cooldown: 4,
    desc: 'Des étoiles s\'abattent sur tous les ennemis (70 % de les projeter en l\'air).',
    target: 'enemies', move: 'none', anim: 'cast',
    vfx: { cast: 'star-aura', impact: 'meteor' },
    hits: [{ power: 0.8, state: 'HIGH', stateChance: 0.7 }],
  },
  pursuits: [{
    id: 'hoshi-comet', name: 'Comète', triggers: ['HIGH', 'PUSH'],
    desc: 'Une comète frappe l\'ennemi en l\'air ou repoussé et le plaque au sol.',
    move: 'ranged', anim: 'cast', vfx: { travel: 'comet', impact: 'blast' },
    hits: [{ power: 0.85, state: 'LOW' }],
  }],
  passives: [{
    id: 'stardust', name: 'Poussière d\'Étoiles', desc: 'Gagne 20 chakra en éliminant un ennemi.',
    onKill: (battle, unit) => battle.addChakra(unit, 20),
  }],
});
