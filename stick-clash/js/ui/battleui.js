/* ============================================================
 * Interface de combat : barre d'actions, ciblage, aperçu des poursuites,
 * ordre de jeu, journal, vitesse, mode auto, écran de résultat.
 * ============================================================ */
(function (root) {
  'use strict';
  const SC = root.SC;
  const D = SC.describe;
  const esc = D.esc;
  const SPEEDS = [0.5, 1, 2, 4];

  class BattleUI {
    constructor(el, opts) {
      this.el = el; this.opts = opts;
      this.q = s => el.querySelector(s);
      this.canvas = this.q('#stage');
      this.speedIdx = 1;
      this.pending = null; this.selected = null;
      this.dead = false;
      this.q('#btn-speed').onclick = () => this.cycleSpeed();
      this.q('#btn-auto').onclick = () => this.setAuto(!this.auto);
      this.q('#btn-quit').onclick = () => this.quit();
      this._key = ev => this.onKey(ev);
      window.addEventListener('keydown', this._key);
    }

    // ---------- cycle de vie ----------
    async run(teamA, teamB, mode) {
      this.teamA = teamA; this.teamB = teamB; this.mode = mode;
      this.q('#result').classList.add('hidden');
      this.q('#log').innerHTML = '';
      this.q('#actionbar').innerHTML = '';
      this.q('#hint').innerHTML = '';
      this.stats = { maxCombo: 0, dmg: { A: 0, B: 0 }, chains: 0, pursuits: 0 };

      const battle = this.battle = new SC.Battle({
        teamA, teamB,
        controllers: { A: mode === 'auto' ? 'ai' : 'human', B: 'ai' },
        inputProvider: u => this.askAction(u),
      });
      this.auto = mode === 'auto';
      this.refreshButtons();

      this.stage && this.stage.destroy();
      const stage = this.stage = new SC.Stage(this.canvas);
      stage.speed = SPEEDS[this.speedIdx];
      stage.setup(battle);
      stage.onPick = u => this.onPick(u);
      stage.onHover = u => this.onHover(u);
      stage.start();
      new SC.Director(stage, battle);
      this.hookLog(battle);
      this.buildOrder();

      await battle.run();
      if (!this.dead) this.showResult();
    }

    quit() {
      this.dead = true;
      this.resolvePending(null);
      this.stage && this.stage.destroy();
      window.removeEventListener('keydown', this._key);
      this.opts.onQuit();
    }

    // ---------- contrôles ----------
    cycleSpeed() {
      this.speedIdx = (this.speedIdx + 1) % SPEEDS.length;
      this.stage.speed = SPEEDS[this.speedIdx];
      this.refreshButtons();
    }

    setAuto(v) {
      this.auto = v;
      this.battle.controllers.A = v ? 'ai' : 'human';
      if (v && this.pending) { const u = this.pending.unit; this.resolvePending(SC.AI.choose(this.battle, u)); }
      this.refreshButtons();
    }

    refreshButtons() {
      this.q('#btn-speed').textContent = `Vitesse ×${SPEEDS[this.speedIdx]}`;
      this.q('#btn-auto').textContent = `Auto : ${this.auto ? 'oui' : 'non'}`;
      this.q('#btn-auto').classList.toggle('on', !!this.auto);
    }

    onKey(ev) {
      if (this.el.classList.contains('hidden') || ev.ctrlKey || ev.metaKey) return;
      if (ev.key === 'a' || ev.key === 'A') this.setAuto(!this.auto);
      else if (ev.key === 'v' || ev.key === 'V') this.cycleSpeed();
      else if (ev.key === 'Escape') this.cancelTargeting();
      else if (this.pending && /^[1-3]$/.test(ev.key)) {
        const ab = this.pending.unit.actions[+ev.key - 1];
        if (ab && this.pending.unit.canUse(ab).ok) this.selectAbility(ab);
      }
    }

    // ---------- saisie du joueur ----------
    askAction(unit) {
      return new Promise(resolve => {
        this.pending = { unit, resolve };
        this.selected = null;
        this.renderActions(unit);
      });
    }

    resolvePending(choice) {
      const p = this.pending; if (!p) return;
      this.pending = null; this.selected = null;
      this.stage && this.stage.setTargeting(null);
      this.q('#hint').innerHTML = '';
      this.q('#actionbar').innerHTML = `<div class="waiting">…</div>`;
      p.resolve(choice);
    }

    renderActions(unit) {
      const bar = this.q('#actionbar');
      const def = unit.def;
      bar.innerHTML = `
        <div class="ab-head"><span class="dot" style="background:${def.look.color}"></span><b>${esc(unit.name)}</b>
          <small>${esc(def.role)}</small>
          <span class="res">PV ${unit.hp}/${unit.maxHp} · Chakra ${unit.chakra}/${unit.maxChakra}</span></div>
        <div class="ab-buttons"></div>`;
      const box = bar.querySelector('.ab-buttons');
      unit.actions.forEach((ab, i) => {
        const can = unit.canUse(ab);
        const b = document.createElement('button');
        b.className = 'act' + (can.ok ? '' : ' off') + ` t-${ab.type}`;
        b.disabled = !can.ok;
        const states = D.statesOf(ab).map(s => D.stateChip(s.state, s.chance < 1 ? ` ${Math.round(s.chance * 100)}%` : '')).join('');
        const sub = ab.type === 'special' ? `Technique · ${ab.cost} chakra · recharge ${ab.cooldown}`
          : ab.type === 'normal' ? `Attaque · +${SC.rules.chakraOnNormal} chakra` : 'Passer · +25 chakra';
        b.innerHTML = `<span class="k">${i + 1}</span><b>${esc(ab.name)}</b><small>${can.ok ? sub : esc(can.reason)}</small><span class="chips">${states}</span>`;
        b.onclick = () => this.selectAbility(ab);
        b.onmouseenter = () => { if (ab.target !== 'enemy' && ab.target !== 'ally') this.showPreview(unit, ab, null); };
        b.onmouseleave = () => { if (!this.selected) this.q('#hint').innerHTML = ''; };
        box.appendChild(b);
      });
    }

    selectAbility(ab) {
      if (!this.pending) return;
      const unit = this.pending.unit;
      if (ab.target === 'enemy' || ab.target === 'ally') {
        this.selected = ab;
        const cands = this.battle.candidateTargets(unit, ab);
        this.stage.setTargeting(cands, ab.target === 'ally' ? 'ally' : 'enemy');
        this.q('#hint').innerHTML = `<b>${esc(ab.name)}</b> — choisissez une cible (clic sur un personnage · Échap pour annuler)`;
        this.q('#actionbar').querySelectorAll('.act').forEach((el, i) => el.classList.toggle('sel', unit.actions[i] === ab));
      } else {
        this.resolvePending({ ability: ab, target: null });
      }
    }

    cancelTargeting() {
      if (!this.selected) return;
      this.selected = null;
      this.stage.setTargeting(null);
      this.q('#hint').innerHTML = '';
      this.q('#actionbar').querySelectorAll('.act').forEach(el => el.classList.remove('sel'));
    }

    onPick(u) {
      if (this.pending && this.selected) this.resolvePending({ ability: this.selected, target: u });
    }

    onHover(u) {
      if (!this.pending || !this.selected) return;
      if (u) this.showPreview(this.pending.unit, this.selected, u);
      else this.q('#hint').innerHTML = `<b>${esc(this.selected.name)}</b> — choisissez une cible`;
    }

    /** Aperçu : états infligés + poursuites probables. */
    showPreview(unit, ab, target) {
      const states = D.statesOf(ab).map(s => D.stateChip(s.state, s.chance < 1 ? ` ${Math.round(s.chance * 100)}%` : '')).join(' ');
      let html = `<b>${esc(ab.name)}</b>${target ? ` → <b>${esc(target.name)}</b>` : ''} ${states}`;
      if (D.statesOf(ab).length) {
        const pv = this.battle.previewChain(unit, ab, target);
        html += pv.steps.length
          ? `<br><span class="trg">Poursuites ${pv.uncertain ? 'possibles' : 'attendues'} :</span> ` + pv.steps.map(s => `<b style="color:${s.pursuer.def.look.color}">${esc(s.pursuer.name)}</b> <small>(${esc(s.pursuit.name)})</small>`).join(' → ')
          : `<br><span class="muted">Aucune poursuite disponible.</span>`;
      }
      this.q('#hint').innerHTML = html;
    }

    // ---------- ordre de jeu ----------
    buildOrder() {
      const box = this.q('#order');
      box.innerHTML = '';
      this.battle.on('round:start', e => {
        this.q('#roundlabel').textContent = `Round ${e.round}`;
        box.innerHTML = '';
        for (const u of e.order) {
          const c = document.createElement('span');
          c.className = `ord side-${u.side}`; c.dataset.id = u.id;
          c.style.setProperty('--c', u.def.look.color);
          c.title = `${u.name} — vitesse ${Math.round(u.stat('spd'))}`;
          c.textContent = u.name;
          box.appendChild(c);
        }
      });
      this.battle.on('turn:start', e => {
        box.querySelectorAll('.ord').forEach(c => c.classList.toggle('now', c.dataset.id === e.unit.id));
        if (!this.pending && this.battle.controllers[e.unit.side] !== 'human') {
          this.q('#actionbar').innerHTML = `<div class="waiting"><b style="color:${e.unit.def.look.color}">${esc(e.unit.name)}</b> ${e.unit.side === 'A' ? '(vous, auto)' : 'joue'}…</div>`;
        }
      });
      this.battle.on('death', e => {
        const c = box.querySelector(`.ord[data-id="${e.unit.id}"]`); if (c) c.classList.add('ko');
      });
    }

    // ---------- journal ----------
    log(html, cls = '') {
      const box = this.q('#log');
      const d = document.createElement('div');
      d.className = 'll ' + cls; d.innerHTML = html;
      box.appendChild(d);
      while (box.children.length > 140) box.removeChild(box.firstChild);
      box.scrollTop = box.scrollHeight;
    }

    hookLog(b) {
      const nm = u => `<b class="n${u.side}">${esc(u.name)}</b>`;
      b.on('round:start', e => this.log(`Round ${e.round}`, 'round'));
      b.on('action:start', e => {
        const a = e.ability;
        if (a.type === 'special') this.log(`${nm(e.actor)} lance <em>${esc(a.name)}</em> !`, 'sp');
        else if (a.type === 'defend') this.log(`${nm(e.actor)} se concentre.`);
        else this.log(`${nm(e.actor)} : ${esc(a.name)}`);
      });
      b.on('attack:begin', e => { if (e.pursuit) this.log(`↳ Poursuite de ${nm(e.actor)} : <em>${esc(e.ability.name)}</em>`, 'pu'); });
      b.on('hit', e => {
        for (const r of e.results) {
          const parts = [];
          if (r.damage) parts.push(`−${r.damage}${r.crit ? ' (critique)' : ''}`);
          if (r.heal) parts.push(`+${r.heal} PV`);
          if (r.state) parts.push(D.stateChip(r.state));
          r.buffs.forEach(x => parts.push(D.buffChip(x.id)));
          if (parts.length) this.log(`&nbsp;&nbsp;→ ${nm(r.target)} ${parts.join(' ')}`, 'hit');
          if (r.damage) this.stats.dmg[e.actor.side] += r.damage;
        }
        if (e.pursuit) this.stats.pursuits++;
      });
      b.on('chain:end', e => {
        this.stats.chains++; this.stats.maxCombo = Math.max(this.stats.maxCombo, e.combo);
        if (e.combo >= 2) this.log(`COMBO ×${e.combo} — ${e.damage} dégâts`, 'combo');
      });
      b.on('dot', e => this.log(`${nm(e.unit)} subit ${e.amount} (${esc(e.buff ? SC.buffs.get(e.buff.id).name : 'effet')})`, 'hit'));
      b.on('heal', e => this.log(`${nm(e.unit)} récupère ${e.amount} PV`, 'hit'));
      b.on('death', e => this.log(`${nm(e.unit)} est K.O.`, 'ko'));
    }

    // ---------- résultat ----------
    showResult() {
      const b = this.battle, w = b.winner, s = this.stats;
      let title, cls;
      if (w === 'draw') { title = 'Match nul'; cls = 'draw'; }
      else if (this.mode === 'auto') { title = w === 'A' ? 'Victoire de l\'équipe bleue' : 'Victoire de l\'équipe rouge'; cls = w === 'A' ? 'win' : 'lose'; }
      else { title = w === 'A' ? 'Victoire !' : 'Défaite…'; cls = w === 'A' ? 'win' : 'lose'; }
      const res = this.q('#result');
      res.className = `result ${cls}`;
      res.innerHTML = `<div class="rbox"><h2>${title}</h2>
        <p>${b.round} rounds · combo max ×${s.maxCombo} · ${s.pursuits} poursuites</p>
        <p class="muted">Dégâts : équipe bleue ${s.dmg.A} · équipe rouge ${s.dmg.B}</p>
        <div class="rbtn"><button class="primary" id="r-again">Rejouer</button><button id="r-menu">Changer d'équipes</button></div></div>`;
      this.q('#r-again').onclick = () => { this.stage.destroy(); this.run(this.teamA, this.teamB, this.mode); };
      this.q('#r-menu').onclick = () => this.quit();
    }
  }

  SC.BattleUI = BattleUI;
})(typeof window !== 'undefined' ? window : globalThis);
