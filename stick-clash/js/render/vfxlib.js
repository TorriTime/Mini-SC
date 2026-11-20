/* ============================================================
 * Bibliothèque d'effets de techniques.
 *
 * Une capacité référence ses effets par nom : vfx: { cast, travel, impact }.
 *   cast   : effet sur le lanceur avant le coup        (c.view = lanceur)
 *   travel : projectile du lanceur vers la cible       (renvoie une Promise)
 *   impact : effet à l'endroit touché                  (peut renvoyer une Promise
 *            = « l'impact n'a lieu qu'à son arrivée », ex. météorite)
 *
 * Contexte `c` : { fx, stage, theme:{main,light,dark}, x, y, view, dir, size, crit,
 *                  index, count, from, to }
 * Ajouter un effet : SC.vfx.impact['mon-effet'] = c => { ... }
 * ============================================================ */
(function (root) {
  'use strict';
  const SC = root.SC;
  const rnd = SC.rnd;
  const V = (SC.vfx = { cast: {}, travel: {}, impact: {} });
  const C = V.cast, T = V.travel, I = V.impact;
  const PI = Math.PI;

  V.play = function (kind, name, ctx) {
    const lib = V[kind];
    const fn = lib[name] || (kind === 'impact' ? lib.punch : null);
    return fn ? fn(ctx) : undefined;
  };

  // ======================== IMPACTS ========================
  I.punch = c => {
    c.fx.glow(c.x, c.y, { r: 46 * c.size, color: c.theme.main, alpha: 0.8, life: 210 });
    c.fx.ring(c.x, c.y, { r0: 6, r1: 36 * c.size, color: c.theme.light, life: 250, width: 5 });
    c.fx.spark(c.x, c.y, { n: 9 + (c.crit ? 8 : 0), color: c.theme.light, speed: 0.34, size: 3, life: 380, angle: c.dir > 0 ? 0 : PI, spread: PI * 1.3 });
  };

  I.slash = c => {
    const a = c.dir > 0 ? 0.85 : PI - 0.85, b = c.dir > 0 ? -0.75 : -(PI - 0.75);
    c.fx.slash(c.x, c.y, { len: 100 * c.size, angle: a, color: c.theme.main, width: 6 });
    c.fx.slash(c.x, c.y, { len: 84 * c.size, angle: b, color: c.theme.light, width: 5, life: 260 });
    c.fx.spark(c.x, c.y, { n: 8, color: c.theme.light, speed: 0.3, life: 330, angle: c.dir > 0 ? 0 : PI, spread: PI });
  };

  I.blast = c => {
    c.fx.glow(c.x, c.y, { r: 90 * c.size, color: c.theme.main, core: c.theme.light, life: 340 });
    c.fx.ring(c.x, c.y, { r0: 8, r1: 78 * c.size, color: c.theme.light, life: 380, width: 7 });
    c.fx.ring(c.x, c.y, { r0: 4, r1: 52 * c.size, color: c.theme.main, life: 300, width: 4 });
    c.fx.spark(c.x, c.y, { n: 18, color: c.theme.main, speed: 0.4, size: 4, life: 520 });
    c.fx.spark(c.x, c.y, { n: 8, color: '#fff', speed: 0.5, size: 2.4, life: 380 });
  };

  I['fire-pillar'] = c => {
    const gy = c.view.y;
    c.fx.pillar(c.x, gy, { w: 58 * c.size, h: 230, color: c.theme.main, core: c.theme.light, life: 560 });
    c.fx.ring(c.x, gy, { r0: 8, r1: 80, color: c.theme.main, life: 420, width: 6, squash: 0.32, layer: 'ground' });
    c.fx.glow(c.x, c.y, { r: 80, color: c.theme.main, core: c.theme.light, life: 360 });
    c.fx.spark(c.x, c.y + 30, { n: 22, color: c.theme.light, speed: 0.2, size: 3.4, life: 800, angle: -PI / 2, spread: 0.9, gravity: -0.00004, jitter: 20 });
  };

  I.geyser = c => {
    const gy = c.view.y;
    c.fx.pillar(c.x, gy, { w: 46 * c.size, h: 200, color: c.theme.main, core: c.theme.light, life: 560 });
    c.fx.ring(c.x, gy, { r0: 6, r1: 70, color: c.theme.light, life: 420, width: 5, squash: 0.32, layer: 'ground' });
    c.fx.spark(c.x, gy - 20, { n: 20, color: c.theme.light, speed: 0.34, size: 3.2, life: 800, angle: -PI / 2, spread: 1.0, gravity: 0.0008, additive: false, alpha: 0.9 });
  };

  I.quake = c => {
    const gy = c.view.y;
    c.fx.ring(c.x, gy, { r0: 10, r1: 110 * c.size, color: c.theme.light, life: 460, width: 7, squash: 0.3, layer: 'ground' });
    c.fx.ring(c.x, gy, { r0: 4, r1: 70 * c.size, color: c.theme.main, life: 380, width: 5, squash: 0.3, layer: 'ground' });
    c.fx.dust(c.x, gy, { n: 10 });
    c.fx.spark(c.x, gy - 6, { n: 12, color: c.theme.main, speed: 0.36, size: 4, life: 700, angle: -PI / 2, spread: PI, gravity: 0.0011, additive: false });
    c.fx.glow(c.x, c.y, { r: 50 * c.size, color: c.theme.light, life: 200, alpha: 0.6 });
  };

  I['bolt-strike'] = c => {
    c.fx.bolt(c.x + rnd(-25, 25), c.y - 330, c.x, c.y, { color: c.theme.main, width: 7, life: 320 });
    c.fx.glow(c.x, c.y, { r: 70, color: c.theme.main, core: '#fff', life: 280 });
    c.fx.spark(c.x, c.y, { n: 12, color: c.theme.main, speed: 0.4, life: 380 });
  };

  I.heal = c => {
    const g = '#8dffb5';
    c.fx.spark(c.x, c.y + 10, { n: 12, color: g, shape: 'star', speed: 0.09, size: 3.2, life: 1000, angle: -PI / 2, spread: 1.4, jitter: 24 });
    c.fx.ring(c.view.x, c.view.y, { r0: 8, r1: 60, color: g, life: 700, width: 4, squash: 0.32, layer: 'ground' });
    c.fx.glow(c.x, c.y, { r: 60, color: g, alpha: 0.5, life: 500 });
  };

  I.meteor = c => {
    const delay = (c.index || 0) * 90;
    return c.stage.wait(delay).then(() => {
      const from = { x: c.x - 170 * c.dir, y: c.y - 430 };
      return c.fx.projectile(from, { x: c.x, y: c.y }, { kind: 'comet', color: c.theme.main, size: 6, speed: 1.9, trail: 260 });
    }).then(() => {
      I.blast(Object.assign({}, c, { size: c.size * 0.9 }));
      c.fx.spark(c.x, c.y, { n: 10, color: c.theme.light, shape: 'star', speed: 0.28, size: 3.4, life: 700 });
    });
  };

  I['shadow-spikes'] = c => {
    const gy = c.view.y, col = c.theme.main, dark = c.theme.dark;
    const xs = [-30, -15, 0, 15, 30].map(d => ({ d, h: rnd(48, 96) }));
    c.fx.add({
      life: 520, layer: 'front',
      draw(ctx, k) {
        const grow = SC.ease.outCubic(Math.min(1, k * 5));
        ctx.globalAlpha = 1 - Math.max(0, k - 0.55) / 0.45;
        for (const s of xs) {
          const h = s.h * grow;
          ctx.fillStyle = dark; ctx.strokeStyle = col; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(c.x + s.d - 8, gy); ctx.lineTo(c.x + s.d + 2, gy - h); ctx.lineTo(c.x + s.d + 8, gy); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
      },
    });
    c.fx.ring(c.x, gy, { r0: 6, r1: 70, color: col, life: 420, width: 5, squash: 0.32, layer: 'ground' });
    c.fx.spark(c.x, c.y, { n: 14, color: col, speed: 0.22, size: 4, life: 600, gravity: -0.00012, additive: false, alpha: 0.85 });
    c.fx.glow(c.x, c.y, { r: 55, color: col, alpha: 0.5, life: 300 });
  };

  I['light-ray'] = c => {
    c.fx.pillar(c.x, c.view.y, { w: 80 * c.size, h: 420, color: c.theme.main, core: '#fff', life: 520 });
    c.fx.glow(c.x, c.y, { r: 100, color: c.theme.main, core: '#fff', life: 420 });
    c.fx.ring(c.view.x, c.view.y, { r0: 8, r1: 80, color: c.theme.light, life: 500, width: 5, squash: 0.32, layer: 'ground' });
    c.fx.spark(c.x, c.y, { n: 14, color: c.theme.light, shape: 'star', speed: 0.2, size: 3.4, life: 800, angle: -PI / 2, spread: 2 });
  };

  I['wind-cut'] = c => {
    for (let i = 0; i < 3; i++) {
      const a = (c.dir > 0 ? -0.1 : PI + 0.1) + rnd(-0.35, 0.35);
      c.fx.slash(c.x + rnd(-10, 10), c.y + rnd(-22, 22), { len: rnd(80, 120) * c.size, angle: a, color: c.theme.main, width: 4.5, bend: 0.14, life: 280 });
    }
    c.fx.spark(c.x, c.y, { n: 10, color: c.theme.light, shape: 'star', speed: 0.32, size: 2.6, life: 520, angle: c.dir > 0 ? 0 : PI, spread: 1.6 });
  };

  // ======================== LANCERS (sur le lanceur) ========================
  const groundRing = (c, o) => c.fx.ring(c.view.x, c.view.y, Object.assign({ squash: 0.32, layer: 'ground', width: 5, life: 600 }, o));

  C['flame-aura'] = c => {
    groundRing(c, { r0: 10, r1: 70, color: c.theme.main });
    c.fx.glow(c.view.x, c.y, { r: 70, color: c.theme.main, core: c.theme.light, life: 420 });
    c.fx.spark(c.view.x, c.view.y - 8, { n: 24, color: c.theme.main, speed: 0.16, size: 3.6, life: 800, angle: -PI / 2, spread: 0.7, jitter: 26, gravity: -0.00006 });
  };

  C['wind-swirl'] = c => {
    groundRing(c, { r0: 10, r1: 80, color: c.theme.main });
    const cx = c.view.x, cy = c.y, s = c.view.scale;
    c.fx.add({
      life: 520, additive: true,
      draw(ctx, k) {
        ctx.strokeStyle = c.theme.main; ctx.lineWidth = 4; ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const a0 = k * 12 + i * 2.1, r = (30 + i * 12) * s;
          ctx.globalAlpha = (1 - k) * 0.9;
          ctx.beginPath(); ctx.ellipse(cx, cy + (i - 1) * 26 * s, r, r * 0.35, 0, a0, a0 + 2.2); ctx.stroke();
        }
      },
    });
    c.fx.spark(cx, c.view.y - 20, { n: 14, color: c.theme.light, shape: 'star', speed: 0.12, size: 2.6, life: 700, angle: -PI / 2, spread: 1.2, jitter: 28 });
  };

  C.charge = c => {
    const cx = c.view.x, cy = c.y;
    c.fx.add({
      life: 420, additive: true,
      draw(ctx, k) {
        ctx.strokeStyle = c.theme.light; ctx.lineWidth = 4; ctx.globalAlpha = k;
        ctx.beginPath(); ctx.arc(cx, cy, 90 * (1 - k) + 8, 0, 7); ctx.stroke();
        ctx.strokeStyle = c.theme.main; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 60 * (1 - k) + 6, 0, 7); ctx.stroke();
      },
    });
    c.fx.glow(cx, cy, { r: 60, color: c.theme.main, life: 420, alpha: 0.5 });
  };

  C.focus = c => {
    const cx = c.view.x, cy = c.y, s = c.view.scale;
    c.fx.add({
      life: 620, additive: true,
      draw(ctx, k) {
        const a = Math.sin(k * PI);
        ctx.globalAlpha = a * 0.28; ctx.fillStyle = '#9fc2ff';
        ctx.beginPath(); ctx.ellipse(cx, cy, 46 * s, 66 * s, 0, 0, 7); ctx.fill();
        ctx.globalAlpha = a * 0.9; ctx.strokeStyle = '#d4e4ff'; ctx.lineWidth = 3; ctx.stroke();
      },
    });
    groundRing(c, { r0: 60, r1: 8, color: '#9fc2ff', life: 500 });
  };

  C['heal-aura'] = c => {
    const g = '#8dffb5';
    groundRing(c, { r0: 10, r1: 90, color: g, life: 800 });
    c.fx.spark(c.view.x, c.view.y - 10, { n: 22, color: g, shape: 'star', speed: 0.1, size: 3.2, life: 1100, angle: -PI / 2, spread: 1.3, jitter: 34 });
    c.fx.glow(c.view.x, c.y, { r: 70, color: g, alpha: 0.5, life: 600 });
  };

  C['shadow-aura'] = c => {
    groundRing(c, { r0: 10, r1: 70, color: c.theme.main });
    c.fx.spark(c.view.x, c.view.y - 10, { n: 22, color: c.theme.main, speed: 0.12, size: 5, life: 800, angle: -PI / 2, spread: 1, jitter: 24, gravity: -0.00008, additive: false, alpha: 0.7 });
  };

  C['star-aura'] = c => {
    groundRing(c, { r0: 10, r1: 85, color: c.theme.main });
    c.fx.spark(c.view.x, c.y, { n: 18, color: c.theme.light, shape: 'star', speed: 0.14, size: 3.2, life: 900, jitter: 40 });
    c.fx.glow(c.view.x, c.y, { r: 70, color: c.theme.main, alpha: 0.5, life: 600 });
  };

  C['lightning-charge'] = c => {
    for (let i = 0; i < 3; i++) {
      const a = rnd(0, PI * 2), r = 42 * c.view.scale;
      c.fx.bolt(c.view.x + Math.cos(a) * r, c.y + Math.sin(a) * r, c.view.x + Math.cos(a + 0.6) * r * 1.5, c.y + Math.sin(a + 0.6) * r * 1.5, { color: c.theme.main, width: 4, jitter: 8, life: 260 });
    }
    groundRing(c, { r0: 10, r1: 70, color: c.theme.main });
  };

  // ======================== TRAJECTOIRES ========================
  T.orb = c => c.fx.projectile(c.from, c.to, { kind: 'orb', color: c.theme.main, size: 9, speed: 1.5 });
  T.shuriken = c => c.fx.projectile(c.from, c.to, { kind: 'shuriken', color: c.theme.main, speed: 1.7 });
  T.arrow = c => c.fx.projectile(c.from, c.to, { kind: 'arrow', color: c.theme.main, speed: 2.1, size: 8 });
  T.wave = c => c.fx.projectile(c.from, c.to, { kind: 'wave', color: c.theme.main, speed: 1.5, size: 24, trail: 160 });
  T.comet = c => c.fx.projectile({ x: c.to.x - 280, y: c.to.y - 360 }, c.to, { kind: 'comet', color: c.theme.main, size: 7, speed: 1.4, trail: 280 });
})(typeof window !== 'undefined' ? window : globalThis);
