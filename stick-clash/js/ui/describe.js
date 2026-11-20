/* ============================================================
 * Descriptions générées automatiquement à partir des données :
 * un nouveau personnage est documenté sans écrire de texte d'interface.
 * ============================================================ */
(function (root) {
  'use strict';
  const SC = root.SC;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const D = (SC.describe = {});
  D.esc = esc;

  D.stateChip = (id, extra = '') => {
    const s = SC.states.get(id);
    return `<span class="chip state" style="--c:${s.color}">${esc(s.name)}${extra}</span>`;
  };
  D.buffChip = id => {
    const b = SC.buffs.get(id);
    return `<span class="chip buff${b.debuff ? ' bad' : ''}" style="--c:${b.color}" title="${esc(b.desc || '')}">${esc(b.name)}</span>`;
  };
  D.elementChip = id => {
    const e = SC.elements.get(id);
    return `<span class="chip el" style="--c:${e.main}">${esc(e.name)}</span>`;
  };

  /** États que peut infliger une capacité : [{state, chance}] */
  D.statesOf = ab => {
    const m = new Map();
    for (const h of ab.hits) if (h.state) m.set(h.state, Math.max(m.get(h.state) || 0, h.stateChance ?? 1));
    return [...m].map(([state, chance]) => ({ state, chance }));
  };

  D.produced = def => {
    const set = new Set();
    [def.normal, def.special, ...def.pursuits].filter(Boolean).forEach(ab => D.statesOf(ab).forEach(s => set.add(s.state)));
    return set;
  };
  D.consumed = def => new Set(def.pursuits.flatMap(p => p.triggers));

  /** Qui lance bien pour moi / qui je relance bien. */
  D.synergy = def => {
    const mine = D.produced(def), eat = D.consumed(def);
    const feeds = [], follows = [];
    for (const o of SC.characters.list()) {
      if (o.id === def.id) continue;
      if ([...D.consumed(o)].some(s => mine.has(s))) follows.push(o);   // o poursuit après moi
      if ([...D.produced(o)].some(s => eat.has(s))) feeds.push(o);      // o me prépare des poursuites
    }
    return { feeds, follows };
  };

  D.abilityHtml = ab => {
    const kind = { normal: 'Normale', special: 'Technique', pursuit: 'Poursuite', defend: 'Universelle' }[ab.type];
    const power = ab.hits.reduce((a, h) => a + h.power, 0);
    const meta = [];
    if (ab.type === 'special') meta.push(`${ab.cost} chakra`, `recharge ${ab.cooldown}`);
    if (power > 0) meta.push(`puissance ×${power.toFixed(2)}${ab.hits.length > 1 ? ` (${ab.hits.length} coups)` : ''}`);
    const tgt = { enemy: 'un ennemi', enemies: 'tous les ennemis', ally: 'un allié', allies: 'toute l\'équipe', self: 'soi' }[ab.target];
    meta.push(tgt);
    const states = D.statesOf(ab).map(s => D.stateChip(s.state, s.chance < 1 ? ` ${Math.round(s.chance * 100)}%` : ''));
    const buffs = [...new Set(ab.hits.flatMap(h => h.buffs.map(b => b.id)))].map(D.buffChip);
    const trig = ab.triggers.length ? `<span class="trg">Se déclenche sur :</span> ${ab.triggers.map(t => D.stateChip(t)).join(' ')}` : '';
    return `<div class="ab ab-${ab.type}">
      <div class="ab-h"><b>${esc(ab.name)}</b><span class="tag">${kind}</span></div>
      <div class="ab-m">${meta.join(' · ')}</div>
      <p>${esc(ab.desc)}</p>
      <div class="chips">${trig}${states.length ? `<span class="trg">Inflige :</span> ${states.join(' ')}` : ''} ${buffs.join(' ')}</div>
    </div>`;
  };

  D.statBars = def => {
    const max = { hp: 1300, atk: 130, def: 100, spd: 130 };
    const row = (k, label) => `<div class="stat"><span>${label}</span><i><b style="width:${Math.min(100, def.stats[k] / max[k] * 100)}%"></b></i><em>${def.stats[k]}</em></div>`;
    return row('hp', 'PV') + row('atk', 'ATK') + row('def', 'DEF') + row('spd', 'VIT');
  };

  D.characterHtml = def => {
    const syn = D.synergy(def);
    const names = l => (l.length ? l.map(c => `<span class="chip" style="--c:${c.look.color}">${esc(c.name)}</span>`).join(' ') : '<em>—</em>');
    return `<div class="cd">
      <div class="cd-top"><div><h3>${esc(def.name)} <small>${esc(def.title)}</small></h3>
        <div>${D.elementChip(def.element)} <span class="chip">${esc(def.role)}</span></div></div>
        <div class="stats">${D.statBars(def)}</div></div>
      ${D.abilityHtml(def.normal)}
      ${def.special ? D.abilityHtml(def.special) : ''}
      ${def.pursuits.map(D.abilityHtml).join('')}
      ${def.passives.map(p => `<div class="ab ab-passive"><div class="ab-h"><b>${esc(p.name)}</b><span class="tag">Passif</span></div><p>${esc(p.desc)}</p></div>`).join('')}
      <div class="syn"><div><span class="trg">Prépare des poursuites pour :</span> ${names(syn.feeds)}</div>
        <div><span class="trg">Poursuit après :</span> ${names(syn.follows)}</div></div>
    </div>`;
  };

  /** Texte d'emplacement dans la formation. */
  D.slotInfo = slot => {
    const m = SC.rules.slotDamageTaken[slot] ?? 1;
    const dmg = m === 1 ? 'dégâts normaux' : m > 1 ? `dégâts subis +${Math.round((m - 1) * 100)} %` : `dégâts subis −${Math.round((1 - m) * 100)} %`;
    return `${slot === 0 ? 'Avant' : slot === SC.rules.teamSize - 1 ? 'Arrière' : 'Milieu'} · ${dmg}` + (slot === 0 ? ' · poursuit en premier' : '');
  };
})(typeof window !== 'undefined' ? window : globalThis);
