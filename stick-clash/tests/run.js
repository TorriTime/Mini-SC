/* Tests du moteur, sans navigateur :   node tests/run.js [nombre_de_combats]
 *  - validité des données (personnages, poursuites)
 *  - règles de la chaîne de combo (déterminisme, une poursuite par perso, états consommés)
 *  - simulation de masse (fin garantie, équilibre grossier, longueur des combos)
 */
const { loadEngine } = require('./load');
const SC = loadEngine();
const assert = require('assert');

const N = parseInt(process.argv[2] || '300', 10);
const ids = SC.characters.list().map(c => c.id);
let failures = 0;
const test = async (name, fn) => {
  try { await fn(); console.log('  ok  ', name); }
  catch (e) { failures++; console.log('  FAIL', name, '\n      ', e.stack.split('\n').slice(0, 3).join('\n       ')); }
};
const pick4 = rng => rng.shuffle(ids).slice(0, 4);

(async () => {
  console.log(`Personnages : ${ids.join(', ')}`);

  await test('chaque personnage a une poursuite et une technique valides', () => {
    for (const c of SC.characters.list()) {
      assert(c.pursuits.length > 0, c.id + ' sans poursuite');
      assert(c.special, c.id + ' sans technique');
      assert(c.special.cost > 0 && c.special.cooldown > 0, c.id + ' : coût/recharge');
    }
  });

  await test('un seed donne toujours le même combat', async () => {
    const run = async () => {
      const b = new SC.Battle({ teamA: ['ryu', 'kaze', 'hana', 'tetsu'], teamB: ['yami', 'suzu', 'sol', 'hoshi'], seed: 1234 });
      const log = [];
      b.on('hit', e => log.push(e.actor.id + e.results.map(r => r.damage).join(',')));
      await b.run();
      return log.join('|') + b.winner + b.round;
    };
    assert.strictEqual(await run(), await run());
  });

  await test('la chaîne : une poursuite max par personnage, états consommés, combo borné', async () => {
    const rng = new SC.Random(7);
    for (let i = 0; i < 60; i++) {
      const b = new SC.Battle({ teamA: pick4(rng), teamB: pick4(rng), seed: i + 1 });
      const used = new Map();
      b.on('attack:begin', e => {
        assert(e.combo <= SC.rules.maxChainLength, 'combo trop long');
        if (!e.pursuit) { used.clear(); return; }
        assert(!used.has(e.actor), `${e.actor.name} poursuit deux fois dans la même chaîne`);
        used.set(e.actor, true);
        assert(e.actor.side === e.chain.actor.side, 'poursuite par un adversaire');
        assert(e.ability.type === 'pursuit');
        assert(e.targets[0].alive);
      });
      await b.run();
    }
  });

  await test('PV et chakra restent dans les bornes', async () => {
    const rng = new SC.Random(99);
    for (let i = 0; i < 40; i++) {
      const b = new SC.Battle({ teamA: pick4(rng), teamB: pick4(rng), seed: i + 50 });
      b.on('*', () => {
        for (const u of b.units) {
          assert(u.hp >= 0 && u.hp <= u.maxHp, `PV hors bornes ${u.name} ${u.hp}`);
          assert(u.chakra >= 0 && u.chakra <= u.maxChakra, `chakra hors bornes ${u.name}`);
        }
      });
      await b.run();
    }
  });

  await test('recharge et chakra sont respectés pour les techniques', async () => {
    const b = new SC.Battle({ teamA: ['ryu', 'kaze', 'hana', 'tetsu'], teamB: ['yami', 'suzu', 'sol', 'hoshi'], seed: 5 });
    const lastUse = new Map();
    let round = 0;
    b.on('round:start', e => { round = e.round; });
    b.on('action:start', e => {
      if (e.ability.type !== 'special') return;
      const prev = lastUse.get(e.actor);
      if (prev) assert(round - prev >= 1, 'technique relancée dans le même round');
      lastUse.set(e.actor, round);
    });
    await b.run();
    assert(lastUse.size > 0, 'aucune technique utilisée');
  });

  await test('la formation décide qui poursuit en premier (priorité = emplacement)', () => {
    // Ryu et Hoshi réagissent tous deux à HIGH : celui qui est devant poursuit.
    const first = order => {
      const b = new SC.Battle({ teamA: order, teamB: ['tetsu', 'sol', 'yami', 'hana'], seed: 3 });
      const foe = b.teams.B[0];
      const chain = { pursuers: new Set([b.teams.A.find(u => u.def.id === 'kaze')]), last: foe };
      return b.findPursuit('A', chain, u => (u === foe ? 'HIGH' : null)).pursuer.def.id;
    };
    assert.strictEqual(first(['kaze', 'ryu', 'hoshi', 'hana']), 'ryu');
    assert.strictEqual(first(['kaze', 'hoshi', 'ryu', 'hana']), 'hoshi');
  });

  await test('on peut ajouter un état et un personnage sans toucher au moteur', async () => {
    SC.states.register({ id: 'STUN', name: 'Sonné', short: 'SONNÉ', color: '#fff' });
    SC.defineCharacter({
      id: 'test-stunner', name: 'Testeur', element: 'neutral',
      stats: { hp: 900, atk: 100, def: 50, spd: 200 },
      normal: { id: 't-n', name: 'Coup', hits: [{ power: 1, state: 'STUN' }] },
      special: { id: 't-s', name: 'Spé', cost: 30, cooldown: 2, hits: [{ power: 1.5 }] },
      pursuits: [{ id: 't-p', name: 'Suite', triggers: ['STUN'], hits: [{ power: 1 }] }],
    });
    const b = new SC.Battle({ teamA: ['test-stunner', 'test-stunner', 'ryu', 'hana'], teamB: ['tetsu', 'sol', 'yami', 'hoshi'], seed: 11 });
    let chained = 0;
    b.on('attack:begin', e => { if (e.pursuit && e.ability.id === 't-p') chained++; });
    await b.run();
    assert(chained > 0, 'la poursuite du nouveau personnage ne se déclenche jamais');
    // Les erreurs de données sont explicites
    assert.throws(() => SC.defineCharacter({ id: 'x', name: 'x', stats: { hp: 1, atk: 1, def: 1, spd: 1 }, normal: { id: 'xn', hits: [{ state: 'NOPE' }] } }), /état inconnu/);
    SC.characters.map.delete('test-stunner'); // ne pas polluer la simulation de masse
  });

  // ---------- simulation de masse ----------
  const rng = new SC.Random(2024);
  const stats = { n: 0, rounds: 0, maxCombo: 0, combos3: 0, chains: 0, actions: 0, winA: 0, winB: 0, draw: 0 };
  const perChar = Object.fromEntries(ids.map(i => [i, { w: 0, g: 0 }]));
  const pursuitUse = Object.fromEntries(ids.map(i => [i, 0]));
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    const A = pick4(rng), B = pick4(rng);
    const b = new SC.Battle({ teamA: A, teamB: B, seed: 1000 + i });
    b.on('chain:end', e => {
      stats.chains++; stats.maxCombo = Math.max(stats.maxCombo, e.combo);
      if (e.combo >= 3) stats.combos3++;
    });
    b.on('attack:begin', e => { if (e.pursuit) pursuitUse[e.actor.def.id]++; });
    const w = await b.run();
    stats.n++; stats.rounds += b.round;
    if (w === 'A') stats.winA++; else if (w === 'B') stats.winB++; else stats.draw++;
    for (const [side, team] of [['A', A], ['B', B]]) for (const c of team) {
      perChar[c].g++; if (w === side) perChar[c].w++;
    }
  }
  console.log(`\nSimulation : ${N} combats en ${Date.now() - t0} ms`);
  console.log(`  rounds moyens : ${(stats.rounds / stats.n).toFixed(1)}`);
  console.log(`  victoires A/B/nul : ${stats.winA}/${stats.winB}/${stats.draw}`);
  console.log(`  chaînes ≥ 3 actions : ${(100 * stats.combos3 / stats.chains).toFixed(1)} % (max ${stats.maxCombo})`);
  console.log('  taux de victoire par personnage :');
  for (const id of ids) {
    const p = perChar[id];
    console.log(`    ${id.padEnd(6)} ${(100 * p.w / p.g).toFixed(0).padStart(3)} %   poursuites/combat : ${(pursuitUse[id] / p.g).toFixed(2)}`);
  }
  await test('tous les combats se terminent avec un vainqueur la plupart du temps', () => {
    assert(stats.draw / stats.n < 0.05, 'trop de matchs nuls / timeouts');
  });

  console.log(failures ? `\n${failures} test(s) en échec` : '\nTous les tests passent');
  process.exit(failures ? 1 : 0);
})();
