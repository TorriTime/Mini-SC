/* Ryu — Bruiser de feu. Lance en projection HAUTE, achève en CHUTE. */
SC.defineCharacter({
  id: 'ryu', name: 'Ryu', title: 'Poing de Feu', role: 'Bruiser', element: 'fire',
  look: { color: '#ff7a45', accent: '#ffd36b', parts: ['hair-spiky', 'headband', 'gloves'] },
  stats: { hp: 900, atk: 105, def: 55, spd: 85, crit: 0.10 },
  normal: {
    id: 'ryu-punch', name: 'Direct du poing', desc: 'Un coup de poing enflammé.',
    anim: 'punch', vfx: { impact: 'punch' },
    hits: [{ power: 1.0 }],
  },
  special: {
    id: 'ryu-uppercut', name: 'Uppercut Solaire', cost: 35, cooldown: 3,
    desc: 'Un uppercut qui projette l\'ennemi en l\'air. Peut brûler.',
    anim: 'uppercut', vfx: { cast: 'flame-aura', impact: 'fire-pillar' },
    hits: [{ power: 1.5, state: 'HIGH', buffs: [{ id: 'burn', duration: 2, chance: 0.5 }] }],
  },
  pursuits: [{
    id: 'ryu-hammer', name: 'Marteau Ardent', triggers: ['HIGH'],
    desc: 'Frappe un ennemi en l\'air et le fait chuter.',
    anim: 'slam', vfx: { impact: 'blast' },
    hits: [{ power: 0.9, state: 'DOWN' }],
  }],
  passives: [{
    id: 'hot-blood', name: 'Sang Chaud', desc: '+20 % ATK sous 50 % de PV.',
    stats: u => (u.hp < u.maxHp * 0.5 ? { atk: 1.2 } : null),
  }],
});
