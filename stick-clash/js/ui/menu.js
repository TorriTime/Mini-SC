/* ============================================================
 * Écran de menu.
 *  - Roster : cartes glissables (ou clic pour ajouter).
 *  - Plateau de formation : 2 équipes × 4 emplacements fixes.
 *      glisser un personnage du roster vers un emplacement (remplace / échange),
 *      glisser un emplacement vers un autre (échange), vers l'autre équipe (copie),
 *      ou le lâcher hors du plateau (retrait).
 *  - Analyse de l'équipe active : enchaînements possibles, trous, formation conseillée.
 * ============================================================ */
(function (root) {
  'use strict';
  const SC = root.SC;
  const D = SC.describe;
  const esc = D.esc;
  const SAVE_KEY = 'stick-clash.v2';
  const N = () => SC.rules.teamSize;

  /** Petites vignettes de stickmen animées (une seule boucle pour toutes). */
  const Previews = {
    items: new Set(), running: false,
    add(canvas, def, scale = 1) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = +canvas.getAttribute('width'), h = +canvas.getAttribute('height');
      canvas.width = w * dpr; canvas.height = h * dpr;
      const view = new SC.StickView(def.look);
      view.scale = scale; view.x = w / 2; view.y = h - 12;
      const it = { canvas, ctx: canvas.getContext('2d'), view, dpr, w, h };
      this.items.add(it);
      if (!this.running) this.loop();
      return it;
    },
    clear() { this.items.clear(); },
    loop() {
      this.running = true;
      let last = performance.now();
      const f = ts => {
        const dt = Math.min(50, ts - last); last = ts;
        for (const it of this.items) {
          if (!it.canvas.isConnected) { this.items.delete(it); continue; }
          it.view.update(dt);
          const c = it.ctx;
          c.setTransform(it.dpr, 0, 0, it.dpr, 0, 0); c.clearRect(0, 0, it.w, it.h);
          c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(it.view.x, it.view.y + 2, 26 * it.view.scale, 6, 0, 0, 7); c.fill();
          it.view.draw(c);
        }
        requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    },
  };
  SC.Previews = Previews;

  class Menu {
    constructor(el, opts) {
      this.el = el; this.opts = opts;
      this.ids = SC.characters.list().map(c => c.id);
      this.teams = { A: Array(N()).fill(null), B: Array(N()).fill(null) };
      this.active = 'A';
      this.mode = 'manual';
      this.drag = null;
      this.hl = [];          // emplacements surlignés (survol d'un enchaînement)
      this.selId = null;     // personnage dont on analyse les combos
      this.load();
      this.build();
      this.render();
    }

    // ---------- données ----------
    load() {
      try {
        const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
        if (s) {
          for (const k of ['A', 'B']) {
            const t = (s.teams?.[k] || []).slice(0, N());
            this.teams[k] = Array.from({ length: N() }, (_, i) => (this.ids.includes(t[i]) ? t[i] : null));
          }
          if (s.mode) this.mode = s.mode;
          if (s.active) this.active = s.active;
        }
      } catch (e) { /* stockage indisponible */ }
      for (const k of ['A', 'B']) if (this.teams[k].every(x => !x)) this.randomize(k, true);
    }
    save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ teams: this.teams, mode: this.mode, active: this.active })); } catch (e) { /* ignore */ } }
    full(side) { return this.teams[side].every(Boolean); }

    randomize(side, silent) {
      const pool = this.ids.slice().sort(() => Math.random() - 0.5).slice(0, N());
      this.teams[side] = Array.from({ length: N() }, (_, i) => pool[i] || null);
      if (!silent) this.commit();
    }

    /** Place `id` à l'emplacement i ; s'il est déjà dans l'équipe, les deux échangent leur place. */
    place(side, i, id) {
      const t = this.teams[side], j = t.indexOf(id), prev = t[i];
      t[i] = id;
      if (j >= 0 && j !== i) t[j] = prev;
      this.commit();
    }
    swap(side, i, j) { const t = this.teams[side]; [t[i], t[j]] = [t[j], t[i]]; this.commit(); }
    remove(side, i) { this.teams[side][i] = null; this.commit(); }
    addFirstFree(id) {
      const t = this.teams[this.active];
      if (t.includes(id)) { t[t.indexOf(id)] = null; }
      else { const i = t.indexOf(null); if (i < 0) return; t[i] = id; }
      this.commit();
    }
    commit() { this.save(); this.render(); }

    // ---------- structure ----------
    build() {
      this.el.innerHTML = `
        <header class="m-head">
          <h1>STICK <span>CLASH</span></h1>
          <p>Composez une équipe, placez-la en formation et repérez vos enchaînements avant le combat.</p>
        </header>
        <div class="m-grid">
          <aside class="m-roster-col" id="m-dropzone-remove">
            <h2>Personnages <small>glissez vers un emplacement · clic = ajouter à l'équipe active</small></h2>
            <div class="roster" id="m-roster"></div>
            <div class="details" id="m-details"><p class="muted">Survolez un personnage pour voir ses techniques, poursuites et synergies.</p></div>
          </aside>
          <main class="m-board-col">
            <div class="board" id="m-board"></div>
            <section class="analysis" id="m-analysis"></section>
            <div class="m-actions">
              <label>Mode
                <select id="m-mode">
                  <option value="manual">Je dirige mon équipe</option>
                  <option value="auto">Spectateur (IA contre IA)</option>
                </select>
              </label>
              <span class="muted small" id="m-hint"></span>
              <button id="m-start" class="primary">Combat !</button>
            </div>
          </main>
        </div>`;
      const mode = this.el.querySelector('#m-mode');
      mode.value = this.mode;
      mode.onchange = e => { this.mode = e.target.value; this.save(); };
      this.el.querySelector('#m-start').onclick = () => this.opts.onStart(this.teams.A.slice(), this.teams.B.slice(), this.mode);

      // Lâcher un emplacement dans la colonne du roster = retirer le personnage
      const rz = this.el.querySelector('#m-dropzone-remove');
      rz.ondragover = ev => { if (this.drag && this.drag.kind === 'slot') { ev.preventDefault(); rz.classList.add('remove-over'); } };
      rz.ondragleave = ev => { if (!rz.contains(ev.relatedTarget)) rz.classList.remove('remove-over'); };
      rz.ondrop = ev => { ev.preventDefault(); rz.classList.remove('remove-over'); if (this.drag?.kind === 'slot') this.remove(this.drag.side, this.drag.i); };
    }

    // ---------- rendu ----------
    render() {
      Previews.clear();
      this.renderRoster();
      this.renderBoard();
      this.renderAnalysis();
      const ok = this.full('A') && this.full('B');
      this.el.querySelector('#m-start').disabled = !ok;
      this.el.querySelector('#m-hint').textContent = ok ? '' : `Chaque équipe doit compter ${N()} personnages.`;
    }

    endDrag() {
      this.drag = null;
      this.el.querySelectorAll('.over,.drag,.remove-over').forEach(e => e.classList.remove('over', 'drag', 'remove-over'));
    }

    renderRoster() {
      const box = this.el.querySelector('#m-roster');
      box.innerHTML = '';
      for (const def of SC.characters.list()) {
        const card = document.createElement('div');
        card.className = 'rcard'; card.tabIndex = 0; card.draggable = true;
        card.style.setProperty('--c', def.look.color);
        const inA = this.teams.A.indexOf(def.id), inB = this.teams.B.indexOf(def.id);
        card.innerHTML = `<canvas width="76" height="92" style="width:76px;height:92px"></canvas>
          <b>${esc(def.name)}</b><small>${esc(def.role)}</small>
          <span class="badges">${inA >= 0 ? `<i class="bA" title="Équipe bleue, emplacement ${inA + 1}">${inA + 1}</i>` : ''}${inB >= 0 ? `<i class="bB" title="Équipe rouge, emplacement ${inB + 1}">${inB + 1}</i>` : ''}</span>`;
        const pv = Previews.add(card.querySelector('canvas'), def, 0.78);
        card.onmouseenter = () => { this.showDetails(def); pv.view.playAnim(def.special ? def.special.anim : def.normal.anim); };
        card.onfocus = () => this.showDetails(def);
        card.onclick = () => this.addFirstFree(def.id);
        card.ondragstart = ev => { this.drag = { kind: 'roster', id: def.id }; ev.dataTransfer.setData('text/plain', def.id); ev.dataTransfer.effectAllowed = 'copyMove'; card.classList.add('drag'); this.showDetails(def); };
        card.ondragend = () => this.endDrag();
        box.appendChild(card);
      }
    }

    renderBoard() {
      const board = this.el.querySelector('#m-board');
      board.innerHTML = '';
      for (const side of ['A', 'B']) {
        const team = this.teams[side];
        const panel = document.createElement('section');
        panel.className = `team-panel side-${side}${this.active === side ? ' active' : ''}`;
        const an = this.full(side) ? SC.analyzeTeam(team) : null;
        panel.innerHTML = `
          <div class="tp-head">
            <button class="tp-title" data-act="select">${side === 'A' ? 'Votre équipe' : 'Équipe adverse'}${this.active === side ? ' <small>· analysée</small>' : ''}</button>
            ${an ? `<span class="tp-best" title="Plus long enchaînement possible">combo max ×${an.best ? an.best.length : 1}</span>` : ''}
            <span class="tp-tools">
              <button class="ghost" data-act="random">Aléatoire</button>
              <button class="ghost" data-act="clear">Vider</button>
              ${side === 'B' ? '<button class="ghost" data-act="mirror">Copier la mienne</button>' : ''}
            </span>
          </div>
          <div class="axis"><span>AVANT · poursuit en premier</span><i></i><span>ARRIÈRE</span></div>
          <div class="slots"></div>`;
        const slots = panel.querySelector('.slots');
        team.forEach((id, i) => slots.appendChild(this.slotEl(side, i, id, an)));
        const q = a => panel.querySelector(`[data-act="${a}"]`);
        q('select').onclick = () => { this.active = side; this.commit(); };
        q('random').onclick = () => this.randomize(side);
        q('clear').onclick = () => { this.teams[side] = Array(N()).fill(null); this.commit(); };
        if (q('mirror')) q('mirror').onclick = () => { this.teams.B = this.teams.A.slice(); this.commit(); };
        board.appendChild(panel);
      }
    }

    slotEl(side, i, id, an) {
      const def = id ? SC.characters.get(id) : null;
      const s = document.createElement('div');
      s.className = 'slot' + (def ? '' : ' empty') + (side === this.active && this.hl.includes(i) ? ' hl' : '') + (def && side === this.active && id === this.selId ? ' sel' : '');
      s.dataset.i = i;
      let role = '';
      if (def) {
        const mk = D.produced(def), eat = D.consumed(def);
        role = `<div class="slot-states">${[...mk].map(x => `<i class="dot-s" style="background:${SC.states.get(x).color}" title="Inflige : ${esc(SC.states.get(x).name)}"></i>`).join('')}<em>→</em>${[...eat].map(x => `<i class="ring-s" style="border-color:${SC.states.get(x).color}" title="Poursuit : ${esc(SC.states.get(x).name)}"></i>`).join('')}</div>`;
      }
      s.innerHTML = `<div class="slot-n">${i + 1}</div>
        ${def ? `<button class="slot-x" title="Retirer">✕</button><canvas width="76" height="88" style="width:76px;height:88px"></canvas><b>${esc(def.name)}</b>${role}`
              : '<div class="slot-empty">+<small>déposez ici</small></div>'}
        <small class="slot-info">${esc(D.slotInfo(i))}</small>`;
      if (def) {
        s.style.setProperty('--c', def.look.color);
        Previews.add(s.querySelector('canvas'), def, 0.72);
        s.draggable = true;
        s.ondragstart = ev => { this.drag = { kind: 'slot', side, i }; ev.dataTransfer.setData('text/plain', `${side}${i}`); ev.dataTransfer.effectAllowed = 'copyMove'; s.classList.add('drag'); };
        s.ondragend = () => this.endDrag();
        s.onmouseenter = () => this.showDetails(def);
        s.querySelector('.slot-x').onclick = ev => { ev.stopPropagation(); this.remove(side, i); };
      }
      s.onclick = () => { this.active = side; if (id) this.selId = id; this.commit(); };
      s.ondragover = ev => { if (!this.drag) return; ev.preventDefault(); ev.dataTransfer.dropEffect = this.drag.kind === 'slot' && this.drag.side !== side ? 'copy' : 'move'; s.classList.add('over'); };
      s.ondragleave = () => s.classList.remove('over');
      s.ondrop = ev => {
        ev.preventDefault();
        const d = this.drag; this.endDrag();
        if (!d) return;
        if (d.kind === 'roster') this.place(side, i, d.id);
        else if (d.side === side) { if (d.i !== i) this.swap(side, d.i, i); }
        else this.place(side, i, this.teams[d.side][d.i]);   // autre équipe : copie
      };
      return s;
    }

    showDetails(def) { this.el.querySelector('#m-details').innerHTML = D.characterHtml(def); }

    // ---------- analyse ----------
    renderAnalysis() {
      const box = this.el.querySelector('#m-analysis');
      const side = this.active, team = this.teams[side];
      const title = side === 'A' ? 'votre équipe' : 'l\'équipe adverse';
      if (!this.full(side)) {
        box.innerHTML = `<h2>Analyse</h2><p class="muted">Complétez ${title} (${team.filter(Boolean).length}/${N()}) pour voir ses enchaînements possibles.</p>`;
        return;
      }
      const an = SC.analyzeTeam(team);
      const opt = SC.bestFormation(team);
      const better = opt.score > an.score + 1e-9;
      const sid = team.includes(this.selId) ? this.selId : team[0];
      this.selId = sid;
      const me = SC.characters.get(sid);
      const chip = u => `<span class="uchip" style="--c:${u.def.look.color}">${esc(u.name)}</span>`;
      const st = id => D.stateChip(id);

      const row = (c, idx) => {
        const flow = [`<span class="step open">${chip(c.opener)}<small>${esc(c.ability.name)}</small></span>`, `<span class="arrow">${st(c.openState)}${c.chance < 1 ? `<small>${Math.round(c.chance * 100)}%</small>` : ''}</span>`];
        c.steps.forEach(s => {
          flow.push(`<span class="step${s.unit.def.id === sid ? ' me' : ''}">${chip(s.unit)}<small>${esc(s.pursuit.name)} · ${Math.round(s.chance * 100)} %</small></span>`);
          flow.push(`<span class="arrow">${s.produced ? st(s.produced) : '<em class="end">fin</em>'}</span>`);
        });
        if (!c.steps.length) flow.push('<span class="muted small">aucune poursuite</span>');
        return `<div class="chain${c.length >= 3 ? ' good' : ''}${c.steps.length ? '' : ' dead'}" data-i="${idx}">
          <span class="len" title="Maximum possible : chaque poursuite n'a qu'une chance de se déclencher">×${c.length}</span><div class="flow">${flow.join('')}</div></div>`;
      };
      const idxOf = c => an.chains.indexOf(c);
      const opens = an.chains.filter(c => c.opener.def.id === sid);
      const follows = an.chains.filter(c => c.opener.def.id !== sid && c.steps.some(s => s.unit.def.id === sid));
      const section = (title, hint, list) => `<h3 class="an-sub">${title} <small>${hint}</small></h3>
        <div class="chains">${list.length ? list.map(c => row(c, idxOf(c))).join('') : '<p class="muted small">Aucun enchaînement avec cette équipe.</p>'}</div>`;

      const warns = an.warnings.filter(w => w.units.includes(sid));
      const best = Math.max(0, ...opens.map(c => c.length), ...follows.map(c => c.length));

      box.innerHTML = `
        <div class="an-head"><h2>Combos de <span class="uchip" style="--c:${me.look.color}">${esc(me.name)}</span> <small>avec la formation actuelle · cliquez un autre personnage pour changer</small></h2>
          <span class="an-sum">${best ? `meilleur combo <b>×${best}</b>` : ''}</span>
          <button class="ghost${better ? ' suggest' : ''}" id="an-opt" ${better ? '' : 'disabled'} title="Teste les 24 ordres possibles pour toute l'équipe">${better ? 'Appliquer la meilleure formation' : 'Formation déjà optimale'}</button></div>
        ${section('Ouvre le combo', `avec ${esc(me.normal.name)}${me.special ? ` ou ${esc(me.special.name)}` : ''}`, opens)}
        ${section('Rejoint le combo', `${me.pursuits.map(p => esc(p.name)).join(', ')} : enchaînements lancés par un allié`, follows)}
        ${warns.length ? `<div class="warns">${warns.map(w => `<div class="warn">⚠ ${esc(w.text)}</div>`).join('')}</div>` : ''}`;

      box.querySelectorAll('.chain').forEach(el => {
        const c = an.chains[+el.dataset.i];
        el.onmouseenter = () => this.highlight(c.slots);
        el.onmouseleave = () => this.highlight([]);
      });
      const ob = box.querySelector('#an-opt');
      ob.onclick = () => { this.teams[side] = opt.order.slice(); this.hl = []; this.commit(); };
    }

    /** Surligne les emplacements de l'équipe active sans tout reconstruire. */
    highlight(slots) {
      this.hl = slots;
      const panel = this.el.querySelector(`.team-panel.side-${this.active}`);
      panel.querySelectorAll('.slot').forEach((s, i) => s.classList.toggle('hl', slots.includes(i)));
    }
  }

  SC.Menu = Menu;
})(typeof window !== 'undefined' ? window : globalThis);
