/* IA : note chaque couple (capacité, cible) et prend le meilleur, avec un peu de bruit.
 * Elle tient compte du potentiel de combo (prévisualisation de la chaîne de poursuites). */
(function (root) {
  'use strict';
  const SC = root.SC;

  SC.AI = {
    choose(battle, unit) {
      let best = null;
      for (const ab of unit.actions) {
        if (!unit.canUse(ab).ok) continue;
        for (const t of battle.candidateTargets(unit, ab)) {
          const score = this.score(battle, unit, ab, t) * (0.9 + battle.rng.next() * 0.2);
          if (!best || score > best.score) best = { ability: ab, target: t, score };
        }
      }
      return best || { ability: unit.normal, target: battle.foesOf(unit)[0] };
    },

    score(battle, unit, ab, target) {
      if (ab.type === 'defend') {
        let s = 15;
        if (unit.special && unit.chakra < unit.special.cost) s += 22;
        if (unit.hp < unit.maxHp * 0.35) s += 20;
        return s;
      }
      const targets = battle.resolveTargets(unit, ab, target);
      const atk = unit.stat('atk');
      let s = 0;
      for (const h of ab.hits) {
        for (const t of targets) {
          const foe = t.side !== unit.side;
          if (h.power > 0 && foe) {
            const dmg = SC.rules.damageScale * atk * h.power * (SC.rules.defenseConstant / (SC.rules.defenseConstant + t.stat('def')));
            s += dmg;
            if (dmg >= t.hp) s += 120;
            s += (1 - t.hp / t.maxHp) * 25;
          }
          if (h.heal > 0 && !foe) s += Math.min(t.maxHp - t.hp, atk * h.heal) * 1.15;
          for (const b of h.buffs) {
            const d = SC.buffs.get(b.id);
            const onFoe = (b.to !== 'self') && foe;
            const onAlly = (b.to === 'self' || !foe) && !d.debuff;
            if (onFoe && d.debuff && !t.hasBuff(b.id)) s += 22 * b.chance;
            if (onAlly && !unit.hasBuff(b.id) && d.stats) s += 30 * b.chance;
          }
        }
      }
      if (targets.some(t => t.side !== unit.side)) {
        const pv = battle.previewChain(unit, ab, target);
        for (const st of pv.steps) s += (st.estimate + 18) * st.cumulative * (pv.uncertain ? 0.65 : 1);
      }
      if (ab.type === 'special') s *= 1.1;
      return s;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
