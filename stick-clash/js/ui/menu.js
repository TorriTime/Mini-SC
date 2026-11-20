/* ============================================================
 * Écran de menu : roster, composition des équipes, formation
 * (réordonner par glisser-déposer ou flèches), mode de jeu.
 * ============================================================ */
(function (root) {
  'use strict';
  const SC = root.SC;
  const esc = s => SC.describe.esc(s);
  const SAVE_KEY = 'stick-clash.v1';

  /** Petites vignettes de stickmen animées (une seule boucle pour toutes). */
  const Previews = {
    items: new Set(), running: false,
    add(canvas, def, scale = 1) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth || +canvas.getAttribute('width'), h = canvas.clientHeight || +canvas.getAttribute('height');
      canvas.width = w * dpr; canvas.height = h * dpr;
      const view = new SC.StickView(def.look);
      view.scale = scale; view.x = w / 2; view.y = h - 14;
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
      this.teams = { A: [], B: [] };
      this.active = 'A';
      this.mode = 'manual';
      this.load();
      this.build();
      this.render();
    }

    // ---------- persistance ----------
    load() {
      try {
        const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
        if (s) {
          for (const k of ['A', 'B']) this.teams[k] = (s.teams?.[k] || []).filter(id => this.ids.includes(id)).slice(0, SC.rules.teamSize);
          if (s.mode) this.mode = s.mode;
        }
      } catch (e) { /* stockage indisponible : on ignore */ }
      for (const k of ['A', 'B']) if (this.teams[k].length === 0) this.randomize(k, true);
    }
    save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ teams: this.teams, mode: this.mode })); } catch (e) { /* ignore */ } }

    randomize(side, silent) {
      const pool = this.ids.slice().sort(() => Math.random() - 0.5);
      this.teams[side] = pool.slice(0, SC.rules.teamSize);
      if (!silent) { this.save(); this.render(); }
    }

    // ---------- structure ----------
    build() {
      this.el.innerHTML = `
        <header class="m-head">
          <h1>STICK <span>CLASH</span></h1>
          <p>Combats d'équipes au tour par tour : projections, poursuites et combos en chaîne.</p>
        </header>
        <div class="m-main">
          <div class="m-left">
            <h2>Personnages <small>clic : ajouter / retirer de l'équipe sélectionnée</small></h2>
            <div class="roster" id="m-roster"></div>
            <div class="details" id="m-details"><p class="muted">Survolez un personnage pour voir ses techniques, poursuites et synergies.</p></div>
          </div>
          <div class="m-right">
            <div class="team-panel" data-side="A"></div>
            <div class="team-panel" data-side="B"></div>
            <div class="m-actions">
              <label>Mode
                <select id="m-mode">
                  <option value="manual">Je dirige mon équipe</option>
                  <option value="auto">Spectateur (IA contre IA)</option>
                </select>
              </label>
              <button id="m-start" class="primary">Combat !</button>
            </div>
            <p class="muted small" id="m-hint"></p>
          </div>
        </div>`;
      this.el.querySelector('#m-mode').value = this.mode;
      this.el.querySelector('#m-mode').onchange = e => { this.mode = e.target.value; this.save(); };
      this.el.querySelector('#m-start').onclick = () => this.opts.onStart(this.teams.A.slice(), this.teams.B.slice(), this.mode);
    }

    // ---------- rendu ----------
    render() {
      Previews.clear();
      this.renderRoster();
      this.renderTeam('A'); this.renderTeam('B');
      const ok = this.teams.A.length === SC.rules.teamSize && this.teams.B.length === SC.rules.teamSize;
      const btn = this.el.querySelector('#m-start');
      btn.disabled = !ok;
      this.el.querySelector('#m-hint').textContent = ok ? 'Astuce : l\'ordre des emplacements décide qui poursuit en premier (l\'emplacement 1 est prioritaire).' : `Chaque équipe doit compter ${SC.rules.teamSize} personnages.`;
    }

    renderRoster() {
      const box = this.el.querySelector('#m-roster');
      box.innerHTML = '';
      for (const def of SC.characters.list()) {
        const el = document.createElement('button');
        el.className = 'rcard';
        const el_ = SC.elements.get(def.element);
        const inA = this.teams.A.indexOf(def.id), inB = this.teams.B.indexOf(def.id);
        el.style.setProperty('--c', def.look.color);
        el.innerHTML = `<canvas width="84" height="104" style="width:84px;height:104px"></canvas>
          <b>${esc(def.name)}</b><small>${esc(def.role)} · ${esc(el_.name)}</small>
          <span class="badges">${inA >= 0 ? `<i class="bA">${inA + 1}</i>` : ''}${inB >= 0 ? `<i class="bB">${inB + 1}</i>` : ''}</span>`;
        const pv = Previews.add(el.querySelector('canvas'), def, 0.82);
        el.onmouseenter = () => { this.showDetails(def); pv.view.playAnim(def.special ? def.special.anim : def.normal.anim); };
        el.onfocus = () => this.showDetails(def);
        el.onclick = () => this.toggle(def.id);
        box.appendChild(el);
      }
    }

    renderTeam(side) {
      const panel = this.el.querySelector(`.team-panel[data-side="${side}"]`);
      const team = this.teams[side];
      panel.className = `team-panel side-${side}${this.active === side ? ' active' : ''}`;
      panel.innerHTML = `
        <div class="tp-head">
          <h2>${side === 'A' ? 'Votre équipe' : 'Équipe adverse'}</h2>
          <span class="tp-count">${team.length}/${SC.rules.teamSize}</span>
          <button class="ghost" data-act="select">${this.active === side ? 'Sélectionnée' : 'Sélectionner'}</button>
          <button class="ghost" data-act="random">Aléatoire</button>
          <button class="ghost" data-act="clear">Vider</button>
          ${side === 'B' ? '<button class="ghost" data-act="mirror">Copier la mienne</button>' : ''}
        </div>
        <div class="slots"></div>`;
      const slots = panel.querySelector('.slots');
      for (let i = 0; i < SC.rules.teamSize; i++) {
        const id = team[i], def = id ? SC.characters.get(id) : null;
        const s = document.createElement('div');
        s.className = 'slot' + (def ? '' : ' empty');
        s.dataset.i = i;
        s.innerHTML = `<div class="slot-n">${i + 1}</div>
          ${def ? `<canvas width="84" height="96" style="width:84px;height:96px"></canvas><b>${esc(def.name)}</b>` : '<div class="slot-empty">+</div>'}
          <small>${esc(SC.describe.slotInfo(i))}</small>
          ${def ? `<div class="slot-btns"><button data-m="-1" title="Reculer d'une place (vers l'avant)">◀</button><button data-m="1" title="Avancer d'une place (vers l'arrière)">▶</button><button data-m="x" title="Retirer">✕</button></div>` : ''}`;
        if (def) {
          s.style.setProperty('--c', def.look.color);
          Previews.add(s.querySelector('canvas'), def, 0.78);
          s.draggable = true;
          s.ondragstart = ev => { ev.dataTransfer.setData('text/plain', `${side}:${i}`); ev.dataTransfer.effectAllowed = 'move'; s.classList.add('drag'); };
          s.ondragend = () => s.classList.remove('drag');
          s.onmouseenter = () => this.showDetails(def);
        }
        s.ondragover = ev => { ev.preventDefault(); s.classList.add('over'); };
        s.ondragleave = () => s.classList.remove('over');
        s.ondrop = ev => {
          ev.preventDefault(); s.classList.remove('over');
          const [fs, fi] = ev.dataTransfer.getData('text/plain').split(':');
          if (fs === side) this.move(side, +fi, i);
        };
        s.onclick = ev => {
          const m = ev.target.dataset && ev.target.dataset.m;
          if (m === 'x') this.teams[side].splice(i, 1);
          else if (m) this.move(side, i, i + (+m), true);
          else { this.active = side; this.render(); return; }
          this.save(); this.render();
        };
        slots.appendChild(s);
      }
      panel.querySelector('[data-act="select"]').onclick = () => { this.active = side; this.render(); };
      panel.querySelector('[data-act="random"]').onclick = () => this.randomize(side);
      panel.querySelector('[data-act="clear"]').onclick = () => { this.teams[side] = []; this.save(); this.render(); };
      const mir = panel.querySelector('[data-act="mirror"]');
      if (mir) mir.onclick = () => { this.teams.B = this.teams.A.slice(); this.save(); this.render(); };
    }

    showDetails(def) { this.el.querySelector('#m-details').innerHTML = SC.describe.characterHtml(def); }

    toggle(id) {
      const t = this.teams[this.active], i = t.indexOf(id);
      if (i >= 0) t.splice(i, 1);
      else if (t.length < SC.rules.teamSize) t.push(id);
      this.save(); this.render();
    }

    move(side, from, to) {
      const t = this.teams[side];
      if (from >= t.length || to < 0 || to >= t.length || from === to) return;
      const [x] = t.splice(from, 1); t.splice(to, 0, x);
      this.save(); this.render();
    }
  }

  SC.Menu = Menu;
})(typeof window !== 'undefined' ? window : globalThis);
