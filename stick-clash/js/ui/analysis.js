/* ============================================================
 * Analyse d'une équipe : quels enchaînements sont possibles, avec quelle
 * formation, et où sont les trous. S'appuie sur Battle.previewChain, donc
 * toute nouvelle règle de poursuite est prise en compte automatiquement.
 * ============================================================ */
(function (root) {
  'use strict';
  const SC = root.SC;
  const THRESH = 0.4; // même seuil que previewChain : état « probable »

  const statesOf = ab => SC.describe.statesOf(ab);
  const lastState = hits => { let s = null; for (const h of hits) if (h.state && (h.stateChance ?? 1) >= THRESH) s = h.state; return s; };

  /** @param ids 4 identifiants de personnages, dans l'ordre de la formation */
  SC.analyzeTeam = function (ids) {
    const dummy = Array(4).fill(SC.characters.list()[0].id);
    const b = new SC.Battle({ teamA: ids, teamB: dummy, seed: 1 });
    const team = b.teams.A, foe = b.teams.B[0];
    const chains = [];

    for (const u of team) {
      for (const ab of [u.normal, u.special].filter(Boolean)) {
        const sts = statesOf(ab);
        if (!sts.length) continue;
        const pv = b.previewChain(u, ab, foe);
        let cur = lastState(ab.hits);
        const steps = pv.steps.map(s => {
          const consumed = cur;
          cur = lastState(s.pursuit.hits);
          return { unit: s.pursuer, pursuit: s.pursuit, consumed, produced: cur, estimate: s.estimate };
        });
        const chance = Math.max(...sts.map(s => s.chance));
        chains.push({
          opener: u, ability: ab, openState: lastState(ab.hits) || sts[0].state, chance,
          steps, length: 1 + steps.length, uncertain: pv.uncertain, slots: [u.slot, ...steps.map(s => s.unit.slot)],
          power: steps.reduce((a, s) => a + s.estimate, 0),
        });
      }
    }
    chains.sort((a, b2) => b2.length - a.length || b2.power - a.power);

    // Couverture par état
    const coverage = SC.states.list().map(st => {
      const producers = team.filter(u => [u.normal, u.special, ...u.pursuits].some(a => a && statesOf(a).some(s => s.state === st.id)));
      const consumers = team.filter(u => u.pursuits.some(p => p.triggers.includes(st.id)));
      return { state: st, producers, consumers };
    });

    // Avertissements
    const warnings = [];
    for (const c of coverage) {
      if (c.producers.length && !c.producers.some(p => c.consumers.some(q => q !== p))) {
        warnings.push(`Personne ne poursuit « ${c.state.name} » (créé par ${c.producers.map(u => u.name).join(', ')}).`);
      }
    }
    for (const u of team) {
      for (const p of u.pursuits) {
        const fed = p.triggers.some(t => team.some(o => o !== u && coverageHas(coverage, t, o)));
        if (!fed) warnings.push(`${u.name} (${p.name}) ne sera jamais déclenché : aucun allié n'inflige ${p.triggers.map(t => SC.states.get(t).name).join(' / ')}.`);
      }
    }
    const best = chains[0] || null;
    const score = chains.reduce((a, c) => a + (c.length - 1) * (c.length - 1) * (c.uncertain ? 0.7 : 1), 0) + (best ? (best.length - 1) * 3 : 0);
    return { chains, coverage, warnings, best, score, team };
  };

  function coverageHas(coverage, stateId, unit) {
    return coverage.find(c => c.state.id === stateId).producers.includes(unit);
  }

  /** Teste les 24 ordres possibles et renvoie le meilleur (en gardant l'ordre actuel si égalité). */
  SC.bestFormation = function (ids) {
    const perms = [];
    const rec = (arr, rest) => { if (!rest.length) perms.push(arr); rest.forEach((x, i) => rec([...arr, x], rest.filter((_, j) => j !== i))); };
    rec([], ids.slice());
    let best = ids, bs = SC.analyzeTeam(ids).score;
    for (const p of perms) { const s = SC.analyzeTeam(p).score; if (s > bs + 1e-9) { bs = s; best = p; } }
    return { order: best, score: bs, current: SC.analyzeTeam(ids).score };
  };
})(typeof window !== 'undefined' ? window : globalThis);
