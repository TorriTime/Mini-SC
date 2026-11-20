/* ============================================================
 * Scène : canvas, boucle de rendu, caméra, décor, HUD des unités,
 * bannières, compteur de combo, ciblage à la souris.
 *
 * Le temps de la scène est « mis à l'échelle » (vitesse choisie par le joueur,
 * ralenti d'impact) : tout ce qui attend passe par stage.wait()/tween().
 * ============================================================ */
(function (root) {
  'use strict';
  const SC = root.SC;
  const W = SC.layout.width, H = SC.layout.height;
  const depthScale = y => 1.3 + (y - 340) / 140 * 0.2;

  class Stage {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.fx = new SC.FX();
      this.views = new Map();
      this.timers = [];
      this.tweens = [];
      this.speed = 1;
      this.hitstopLeft = 0;
      this.clock = 0;
      this.cam = { x: W / 2, y: H / 2, z: 1, tx: W / 2, ty: H / 2, tz: 1 };
      this.shakeLeft = 0; this.shakeMag = 0; this.shakeX = 0; this.shakeY = 0;
      this.flashes = [];
      this.banners = [];
      this.combo = null;
      this.active = null;
      this.targeting = null;
      this.hover = null;
      this.onPick = null; this.onHover = null;
      this.running = false;
      this._ac = new AbortController();
      this._bindInput();
      this.resize();
      this._onResize = () => this.resize();
      window.addEventListener('resize', this._onResize);
    }

    // ---------- mise en place ----------
    setup(battle) {
      this.battle = battle;
      this.views.clear();
      for (const u of battle.units) {
        const v = new SC.StickView(u.def.look);
        const [x, y] = SC.layout.slots[u.side][u.slot];
        v.homeX = x; v.homeY = y; v.x = x; v.y = y;
        v.homeFace = u.side === 'A' ? 1 : -1; v.face = v.homeFace;
        v.scale = depthScale(y);
        v.unit = u;
        this.views.set(u.id, v);
      }
    }
    view(unit) { return this.views.get(unit.id); }

    resize() {
      const cssW = this.canvas.clientWidth || W;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.width = Math.round(cssW * dpr);
      this.canvas.height = Math.round(cssW * dpr * H / W);
      this.k = this.canvas.width / W;
      this.bg = this._renderBackground();
    }

    destroy() {
      this.running = false;
      this._ac.abort();
      window.removeEventListener('resize', this._onResize);
    }

    start() {
      if (this.running) return;
      this.running = true;
      let last = performance.now();
      const frame = ts => {
        if (!this.running) return;
        const real = Math.min(50, ts - last); last = ts;
        this.tick(real);
        this.render();
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }

    // ---------- temps ----------
    tick(real) {
      let f = this.speed;
      if (this.hitstopLeft > 0) { this.hitstopLeft -= real; f *= 0.06; }
      const dt = real * f;
      this.clock += dt;

      for (const t of this.timers) t.left -= dt;
      if (this.timers.some(t => t.left <= 0)) {
        const fire = this.timers.filter(t => t.left <= 0);
        this.timers = this.timers.filter(t => t.left > 0);
        fire.forEach(t => t.res());
      }
      for (const tw of this.tweens) {
        tw.t += dt;
        const k = Math.min(1, tw.t / tw.d);
        tw.obj[tw.key] = tw.from + (tw.to - tw.from) * tw.ease(k);
        if (k >= 1) { tw.done = true; tw.res(); }
      }
      if (this.tweens.some(t => t.done)) this.tweens = this.tweens.filter(t => !t.done);

      for (const v of this.views.values()) v.update(dt);
      this.fx.update(dt);

      // caméra
      const c = this.cam, a = 1 - Math.exp(-dt * 0.007);
      c.x += (c.tx - c.x) * a; c.y += (c.ty - c.y) * a; c.z += (c.tz - c.z) * a;
      const hw = W / 2 / c.z, hh = H / 2 / c.z;
      c.x = SC.clamp(c.x, hw, W - hw); c.y = SC.clamp(c.y, hh, H - hh);

      // tremblement (en temps réel : reste vif même au ralenti)
      if (this.shakeLeft > 0) {
        this.shakeLeft -= real;
        const m = this.shakeMag * Math.min(1, this.shakeLeft / 120);
        this.shakeX = (Math.random() - 0.5) * 2 * m; this.shakeY = (Math.random() - 0.5) * 2 * m;
      } else { this.shakeX = this.shakeY = 0; }

      for (const u of this.battle ? this.battle.units : []) {
        if (u.ghostHp > u.shownHp) u.ghostHp = Math.max(u.shownHp, u.ghostHp - dt * u.maxHp * 0.00035);
        else u.ghostHp = u.shownHp;
      }
      for (const f of this.flashes) f.t += dt;
      this.flashes = this.flashes.filter(f => f.t < f.life);
      for (const b of this.banners) b.t += dt;
      this.banners = this.banners.filter(b => b.t < b.life);
      if (this.combo) {
        this.combo.pop = Math.max(0, this.combo.pop - dt / 260);
        if (this.combo.ending) { this.combo.fade += dt; if (this.combo.fade > 1700) this.combo = null; }
      }
    }

    wait(ms) { return new Promise(res => this.timers.push({ left: ms, res })); }

    tween(obj, key, to, ms, ease = 'outQuad') {
      return new Promise(res => this.tweens.push({ obj, key, from: obj[key], to, t: 0, d: Math.max(1, ms), ease: SC.ease[ease], res }));
    }

    /** Ne montre que ces unités (les autres disparaissent en fondu). null = tout le monde. */
    setFocus(units) {
      this.focus = units ? new Set(units) : null;
      for (const v of this.views.values()) v.visTarget = !this.focus || this.focus.has(v.unit) ? 1 : 0;
    }
    addFocus(...units) { if (this.focus) this.setFocus([...this.focus, ...units]); }

    // ---------- effets d'écran ----------
    shake(mag, ms) { this.shakeMag = Math.max(this.shakeMag * (this.shakeLeft > 0 ? 1 : 0), mag); this.shakeLeft = Math.max(this.shakeLeft, ms); }
    hitStop(ms) { this.hitstopLeft = Math.max(this.hitstopLeft, ms); }
    flash(color, alpha, ms) { this.flashes.push({ color, alpha, life: ms, t: 0 }); }
    camFocus(x, y, z) { this.cam.tx = x; this.cam.ty = y; this.cam.tz = z; }
    camReset() { this.camFocus(W / 2, H / 2, 1); }
    banner(title, sub, color) { this.banners.push({ title, sub, color, t: 0, life: 1300 }); }
    setCombo(n, dmg) {
      if (!this.combo || this.combo.ending) this.combo = { n: 0, dmg: 0, pop: 0, ending: false, fade: 0 };
      if (n !== this.combo.n) this.combo.pop = 1;
      this.combo.n = n; this.combo.dmg = dmg;
    }
    endCombo() { if (this.combo) { this.combo.ending = true; this.combo.fade = 0; } }

    // ---------- ciblage ----------
    setTargeting(units, kind) { this.targeting = units ? { units: new Set(units), kind } : null; if (!units) this._setHover(null); }

    _bindInput() {
      const toWorld = ev => {
        const r = this.canvas.getBoundingClientRect();
        const sx = (ev.clientX - r.left) / r.width * W, sy = (ev.clientY - r.top) / r.height * H;
        const c = this.cam;
        return { x: (sx - W / 2) / c.z + c.x, y: (sy - H / 2) / c.z + c.y };
      };
      const pick = ev => {
        if (!this.targeting) return null;
        const p = toWorld(ev);
        let best = null, bd = 1e9;
        for (const u of this.targeting.units) {
          const v = this.view(u);
          const dx = Math.abs(p.x - v.x), top = v.y - 135 * v.scale, bot = v.y + 16 * v.scale;
          if (dx < 42 * v.scale && p.y > top && p.y < bot && dx < bd) { best = u; bd = dx; }
        }
        return best;
      };
      const o = { signal: this._ac.signal };
      this.canvas.addEventListener('pointermove', ev => { const u = pick(ev); this._setHover(u); this.canvas.style.cursor = u ? 'pointer' : 'default'; }, o);
      this.canvas.addEventListener('pointerleave', () => this._setHover(null), o);
      this.canvas.addEventListener('click', ev => { const u = pick(ev); if (u && this.onPick) this.onPick(u); }, o);
    }

    _setHover(u) {
      if (u === this.hover) return;
      this.hover = u;
      if (this.onHover) this.onHover(u);
    }

    // ---------- rendu ----------
    render() {
      const ctx = this.ctx, c = this.cam;
      ctx.setTransform(this.k, 0, 0, this.k, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W / 2, H / 2); ctx.scale(c.z, c.z); ctx.translate(-c.x + this.shakeX, -c.y + this.shakeY);

      ctx.drawImage(this.bg, 0, 0, W, H);
      this._drawSlots(ctx);
      this.fx.draw(ctx, 'ground');

      const views = [...this.views.values()].filter(v => !(v.dead && v.alpha <= 0.01) && v.vis > 0.01).sort((a, b) => a.y - b.y);
      for (const v of views) this._drawShadow(ctx, v);
      this._drawTargetRings(ctx);
      for (const v of views) v.draw(ctx);
      this.fx.draw(ctx, 'front');
      for (const v of views) this._drawHud(ctx, v);
      this.fx.draw(ctx, 'top');
      ctx.restore();

      this._drawOverlays(ctx);
    }

    _drawShadow(ctx, v) {
      const air = Math.max(0, -v.pose.ry) / 160;
      ctx.save();
      ctx.globalAlpha = 0.38 * (1 - air * 0.6) * v.alpha * v.vis;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(v.x, v.y + 2, 30 * v.scale * (1 - air * 0.35), 8 * v.scale, 0, 0, 7); ctx.fill();
      ctx.restore();
    }

    _drawSlots(ctx) {
      ctx.save();
      ctx.lineWidth = 1.5; ctx.setLineDash([5, 5]);
      for (const side of ['A', 'B']) {
        SC.layout.slots[side].forEach(([x, y], i) => {
          ctx.strokeStyle = side === 'A' ? 'rgba(110,190,255,0.22)' : 'rgba(255,120,120,0.22)';
          ctx.beginPath(); ctx.ellipse(x, y + 2, 46, 13, 0, 0, 7); ctx.stroke();
        });
      }
      ctx.restore();
    }

    _drawTargetRings(ctx) {
      if (!this.targeting) return;
      const pulse = 0.5 + 0.5 * Math.sin(this.clock / 160);
      for (const u of this.targeting.units) {
        const v = this.view(u), hot = u === this.hover;
        const col = this.targeting.kind === 'ally' ? '120,255,170' : '255,90,90';
        ctx.save();
        ctx.strokeStyle = `rgba(${col},${hot ? 1 : 0.55 + pulse * 0.3})`;
        ctx.lineWidth = hot ? 4 : 2.5;
        ctx.fillStyle = `rgba(${col},${hot ? 0.28 : 0.1})`;
        ctx.beginPath(); ctx.ellipse(v.x, v.y + 2, (hot ? 50 : 44) * v.scale, 14 * v.scale, 0, 0, 7); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    }

    _drawHud(ctx, v) {
      const u = v.unit; if (!u) return;
      const alpha = (v.dead ? v.alpha : 1) * v.vis;
      if (alpha <= 0.02) return;
      const bw = 78, x = v.x - bw / 2;
      const topY = v.topY() - 8;
      const hy = topY - 4;
      ctx.save();
      ctx.globalAlpha = alpha;

      // marqueur de tour
      if (this.active === u) {
        const b = Math.sin(this.clock / 150) * 3;
        ctx.fillStyle = '#ffd24a'; ctx.strokeStyle = '#2a1f00'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(v.x - 9, hy - 40 + b); ctx.lineTo(v.x + 9, hy - 40 + b); ctx.lineTo(v.x, hy - 27 + b); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      // étiquette d'état
      if (u.state && u.alive) {
        const s = SC.states.get(u.state);
        ctx.font = '800 11px "Trebuchet MS", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const tw = ctx.measureText(s.short).width + 12;
        ctx.fillStyle = s.color; ctx.beginPath(); ctx.roundRect(v.x - tw / 2, hy - 38, tw, 16, 8); ctx.fill();
        ctx.fillStyle = '#1a1030'; ctx.fillText(s.short, v.x, hy - 29.5);
      }
      // nom
      ctx.font = '700 12px "Trebuchet MS", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(8,8,20,.9)'; ctx.strokeText(u.name, v.x, hy - 3);
      ctx.fillStyle = u.side === 'A' ? '#bfe3ff' : '#ffc4c4'; ctx.fillText(u.name, v.x, hy - 3);
      // PV
      const pct = SC.clamp(u.shownHp / u.maxHp, 0, 1), gp = SC.clamp(u.ghostHp / u.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(8,8,20,.75)'; ctx.beginPath(); ctx.roundRect(x - 1, hy - 1, bw + 2, 10, 4); ctx.fill();
      ctx.fillStyle = '#ffd1d1'; ctx.beginPath(); ctx.roundRect(x, hy, bw * gp, 8, 3); ctx.fill();
      ctx.fillStyle = pct > 0.5 ? '#58e07a' : pct > 0.25 ? '#f2cf3c' : '#ff5a4a';
      ctx.beginPath(); ctx.roundRect(x, hy, Math.max(0, bw * pct), 8, 3); ctx.fill();
      // chakra
      ctx.fillStyle = 'rgba(8,8,20,.75)'; ctx.fillRect(x - 1, hy + 10, bw + 2, 6);
      ctx.fillStyle = '#45b7ff'; ctx.fillRect(x, hy + 11, bw * SC.clamp(u.chakra / u.maxChakra, 0, 1), 4);
      if (u.special) { // repère du coût de la technique
        ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(x + bw * u.special.cost / u.maxChakra - 0.5, hy + 10, 1.5, 6);
      }
      // effets
      let bx = x;
      for (const b of u.buffs) {
        const d = SC.buffs.get(b.id);
        ctx.fillStyle = d.color; ctx.beginPath(); ctx.roundRect(bx, hy + 18, 17, 12, 3); ctx.fill();
        ctx.fillStyle = '#10101c'; ctx.font = '800 9px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(d.short + b.duration, bx + 8.5, hy + 24.5);
        bx += 19;
      }
      ctx.restore();
    }

    _drawOverlays(ctx) {
      // flashs
      for (const f of this.flashes) {
        ctx.save(); ctx.globalAlpha = f.alpha * (1 - f.t / f.life); ctx.fillStyle = f.color; ctx.fillRect(0, 0, W, H); ctx.restore();
      }
      // bannières de technique
      for (const b of this.banners) {
        const k = b.t / b.life;
        const inK = SC.ease.outCubic(Math.min(1, k / 0.14)), outK = k > 0.82 ? (k - 0.82) / 0.18 : 0;
        const xo = (1 - inK) * -520 + outK * 520;
        ctx.save();
        ctx.globalAlpha = 1 - outK * 0.6;
        ctx.translate(W / 2 + xo, 76);
        ctx.transform(1, 0, -0.18, 1, 0, 0);
        const g = ctx.createLinearGradient(-420, 0, 420, 0);
        g.addColorStop(0, 'rgba(8,8,24,0)'); g.addColorStop(0.15, 'rgba(8,8,24,.78)'); g.addColorStop(0.85, 'rgba(8,8,24,.78)'); g.addColorStop(1, 'rgba(8,8,24,0)');
        ctx.fillStyle = g; ctx.fillRect(-420, -42, 840, 84);
        ctx.fillStyle = b.color; ctx.fillRect(-380, 38, 760, 3);
        ctx.font = 'italic 900 46px "Trebuchet MS", "Segoe UI", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 7; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(b.title, 0, -6);
        ctx.fillStyle = '#fff'; ctx.fillText(b.title, 0, -6);
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = b.color; ctx.globalAlpha *= 0.45; ctx.fillText(b.title, 0, -6);
        ctx.restore();
        if (b.sub) {
          ctx.save(); ctx.globalAlpha = 1 - outK; ctx.translate(W / 2 + xo, 76); ctx.transform(1, 0, -0.18, 1, 0, 0);
          ctx.font = '700 17px "Trebuchet MS", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = b.color; ctx.fillText(b.sub, 0, 28);
          ctx.restore();
        }
      }
      // compteur de combo
      const cb = this.combo;
      if (cb && cb.n >= 2) {
        const fade = cb.ending ? Math.max(0, 1 - cb.fade / 700) : 1;
        if (fade > 0) {
          const pop = 1 + cb.pop * 0.6;
          ctx.save();
          ctx.globalAlpha = fade;
          ctx.translate(W - 96, 150); ctx.rotate(-0.06); ctx.scale(pop, pop);
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
          ctx.font = '800 18px "Trebuchet MS", system-ui, sans-serif'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.9)';
          ctx.strokeText('COMBO', 0, -44); ctx.fillStyle = '#ffd24a'; ctx.fillText('COMBO', 0, -44);
          ctx.font = 'italic 900 70px "Trebuchet MS", system-ui, sans-serif'; ctx.lineWidth = 9;
          ctx.strokeText(String(cb.n), 0, 2);
          const g = ctx.createLinearGradient(0, -30, 0, 34); g.addColorStop(0, '#fff7c2'); g.addColorStop(1, '#ff9a3c');
          ctx.fillStyle = g; ctx.fillText(String(cb.n), 0, 2);
          ctx.font = '800 16px "Trebuchet MS", system-ui, sans-serif'; ctx.lineWidth = 4;
          ctx.strokeText(`${cb.dmg} dégâts`, 0, 46); ctx.fillStyle = '#fff'; ctx.fillText(`${cb.dmg} dégâts`, 0, 46);
          ctx.restore();
        }
      }
    }

    // ---------- décor (rendu une fois, mis en cache) ----------
    _renderBackground() {
      const cv = document.createElement('canvas');
      cv.width = this.canvas.width; cv.height = this.canvas.height;
      const g = cv.getContext('2d');
      g.scale(this.k, this.k);
      const hz = SC.layout.horizon;
      // ciel
      const sky = g.createLinearGradient(0, 0, 0, hz);
      sky.addColorStop(0, '#0b0820'); sky.addColorStop(0.45, '#2c1650'); sky.addColorStop(0.8, '#a2437a'); sky.addColorStop(1, '#f2906a');
      g.fillStyle = sky; g.fillRect(0, 0, W, hz + 1);
      // étoiles (pseudo-aléatoires stables)
      let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
      g.fillStyle = '#fff';
      for (let i = 0; i < 90; i++) { g.globalAlpha = 0.25 + r() * 0.6; g.beginPath(); g.arc(r() * W, r() * hz * 0.7, r() * 1.4 + 0.3, 0, 7); g.fill(); }
      g.globalAlpha = 1;
      // lune
      const mx = 930, my = 150;
      const halo = g.createRadialGradient(mx, my, 10, mx, my, 150);
      halo.addColorStop(0, 'rgba(255,214,230,.55)'); halo.addColorStop(1, 'rgba(255,214,230,0)');
      g.fillStyle = halo; g.beginPath(); g.arc(mx, my, 150, 0, 7); g.fill();
      g.fillStyle = '#ffe9f1'; g.beginPath(); g.arc(mx, my, 54, 0, 7); g.fill();
      g.fillStyle = 'rgba(214,160,190,.5)'; g.beginPath(); g.arc(mx - 14, my - 8, 9, 0, 7); g.arc(mx + 16, my + 12, 6, 0, 7); g.fill();
      // montagnes
      const ridge = (base, amp, col, seed) => {
        let q = seed; const rr = () => (q = (q * 16807) % 2147483647) / 2147483647;
        g.fillStyle = col; g.beginPath(); g.moveTo(0, hz + 2);
        for (let x = 0; x <= W; x += 40) g.lineTo(x, base - Math.abs(Math.sin(x * 0.006 + seed)) * amp - rr() * amp * 0.35);
        g.lineTo(W, hz + 2); g.closePath(); g.fill();
      };
      ridge(hz - 20, 120, '#3a1d5c', 3);
      ridge(hz - 4, 70, '#27123f', 11);
      // torii lointain
      g.fillStyle = '#3d1230';
      g.fillRect(612, hz - 66, 8, 70); g.fillRect(660, hz - 66, 8, 70);
      g.fillRect(596, hz - 70, 88, 8); g.fillRect(604, hz - 54, 72, 5);
      // sol
      const gr = g.createLinearGradient(0, hz, 0, H);
      gr.addColorStop(0, '#3a2a55'); gr.addColorStop(0.25, '#241a3a'); gr.addColorStop(1, '#0f0b1c');
      g.fillStyle = gr; g.fillRect(0, hz, W, H - hz);
      // liseré d'horizon
      const rim = g.createLinearGradient(0, hz - 6, 0, hz + 10);
      rim.addColorStop(0, 'rgba(255,170,140,0)'); rim.addColorStop(0.5, 'rgba(255,170,140,.5)'); rim.addColorStop(1, 'rgba(255,170,140,0)');
      g.fillStyle = rim; g.fillRect(0, hz - 6, W, 16);
      // perspective : bandes horizontales + lignes qui convergent
      g.strokeStyle = 'rgba(255,255,255,.05)'; g.lineWidth = 1;
      for (let i = 1; i < 14; i++) { const y = hz + Math.pow(i / 14, 1.8) * (H - hz); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(W / 2 + i * 30, hz); g.lineTo(W / 2 + i * 150, H); g.stroke(); }
      // touffes d'herbe
      g.strokeStyle = 'rgba(120,200,140,.25)'; g.lineWidth = 2;
      for (let i = 0; i < 70; i++) { const x = r() * W, y = hz + 20 + r() * (H - hz - 20), h = 5 + r() * 8; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 3, y - h); g.moveTo(x, y); g.lineTo(x + 3, y - h * 0.9); g.stroke(); }
      // bambous sur les côtés
      for (const [bx, sc] of [[26, 1], [78, 0.8], [W - 30, 1], [W - 84, 0.8]]) {
        g.fillStyle = '#16301f'; g.fillRect(bx - 6 * sc, 70, 12 * sc, hz + 40);
        g.fillStyle = '#245236';
        for (let y = 100; y < hz + 40; y += 62) g.fillRect(bx - 8 * sc, y, 16 * sc, 4);
      }
      // vignettage
      const vg = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.7);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.42)');
      g.fillStyle = vg; g.fillRect(0, 0, W, H);
      return cv;
    }
  }

  SC.Stage = Stage;
})(typeof window !== 'undefined' ? window : globalThis);
