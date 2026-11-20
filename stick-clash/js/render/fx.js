/* ============================================================
 * Moteur d'effets visuels : particules, anneaux, éclairs, projectiles, textes.
 * Tout le temps passe par le chronomètre de la scène (dt déjà mis à l'échelle
 * par la vitesse de jeu), donc ralenti / accéléré fonctionnent partout.
 * Les effets nommés (par technique) sont dans vfxlib.js.
 * ============================================================ */
(function (root) {
  'use strict';
  const SC = root.SC;
  const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);

  class FX {
    constructor() { this.items = []; }

    add(it) {
      it.t = 0;
      it.layer = it.layer || 'front';
      this.items.push(it);
      return it;
    }

    update(dt) {
      for (const it of this.items) {
        it.t += dt;
        if (it.update) it.update(dt, it);
        if (it.t >= it.life) it.dead = true;
      }
      if (this.items.some(i => i.dead)) {
        for (const i of this.items) if (i.dead && i.onEnd) { i.onEnd(); i.onEnd = null; }
        this.items = this.items.filter(i => !i.dead);
      }
    }

    draw(ctx, layer) {
      for (const it of this.items) {
        if (it.layer !== layer) continue;
        ctx.save();
        if (it.additive) ctx.globalCompositeOperation = 'lighter';
        it.draw(ctx, Math.min(1, it.t / it.life), it);
        ctx.restore();
      }
    }

    // ---------- primitives ----------

    /** Gerbe de particules. */
    spark(x, y, o = {}) {
      const n = o.n ?? 10, life = o.life ?? 420, sp = o.speed ?? 0.3, size = o.size ?? 3;
      const a0 = o.angle ?? 0, spread = o.spread ?? Math.PI * 2, grav = o.gravity ?? 0;
      const ps = [];
      for (let i = 0; i < n; i++) {
        const a = a0 + (Math.random() - 0.5) * spread, s = sp * rnd(0.4, 1.2);
        ps.push({ x: x + rnd(-1, 1) * (o.jitter || 0), y: y + rnd(-1, 1) * (o.jitter || 0), vx: Math.cos(a) * s, vy: Math.sin(a) * s, s: size * rnd(0.6, 1.4), l: life * rnd(0.6, 1.1) });
      }
      return this.add({
        life: life * 1.15, layer: o.layer, additive: o.additive !== false,
        update(dt) { for (const p of ps) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += grav * dt; p.vx *= 0.995; } },
        draw(ctx, k, it) {
          ctx.fillStyle = o.color || '#fff';
          for (const p of ps) {
            const kk = it.t / p.l; if (kk >= 1) continue;
            ctx.globalAlpha = (1 - kk) * (o.alpha ?? 1);
            const r = p.s * (1 - kk * 0.55);
            if (o.shape === 'star') { star(ctx, p.x, p.y, r * 1.6); } else { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill(); }
          }
        },
      });
    }

    /** Anneau (squash < 1 : posé sur le sol). */
    ring(x, y, o = {}) {
      const r0 = o.r0 ?? 6, r1 = o.r1 ?? 50, w = o.width ?? 4, sq = o.squash ?? 1;
      return this.add({
        life: o.life ?? 320, layer: o.layer, additive: o.additive !== false,
        draw(ctx, k) {
          const e = SC.ease.outCubic(k);
          ctx.globalAlpha = (1 - k) * (o.alpha ?? 1);
          ctx.strokeStyle = o.color || '#fff'; ctx.lineWidth = Math.max(0.5, w * (1 - k));
          ctx.beginPath(); ctx.ellipse(x, y, r0 + (r1 - r0) * e, (r0 + (r1 - r0) * e) * sq, 0, 0, 7); ctx.stroke();
        },
      });
    }

    /** Flash lumineux radial. */
    glow(x, y, o = {}) {
      const r = o.r ?? 60;
      return this.add({
        life: o.life ?? 260, layer: o.layer, additive: true,
        draw(ctx, k) {
          const rr = r * (0.6 + 0.6 * SC.ease.outQuad(k));
          const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
          g.addColorStop(0, o.core || '#fff'); g.addColorStop(0.4, o.color || '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.globalAlpha = (1 - k) * (o.alpha ?? 0.9);
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr, 0, 7); ctx.fill();
        },
      });
    }

    /** Coup de lame en croissant. */
    slash(x, y, o = {}) {
      const len = o.len ?? 80, ang = o.angle ?? -0.6, w = o.width ?? 7, bend = o.bend ?? 0.35;
      const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
      return this.add({
        life: o.life ?? 240, layer: o.layer, additive: true,
        draw(ctx, k) {
          const head = Math.min(1, k * 2.2), tail = Math.max(0, (k - 0.25) * 1.4);
          const pt = u => { const t = (u - 0.5) * len; const c = Math.sin(u * Math.PI) * len * bend; return [x + dx * t + nx * c, y + dy * t + ny * c]; };
          const steps = 14;
          ctx.lineCap = 'round';
          for (const [lw, col, al] of [[w * 1.9, o.color || '#fff', 0.45], [w * 0.7, '#fff', 1]]) {
            ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.globalAlpha = al * (1 - Math.max(0, k - 0.5) * 2);
            ctx.beginPath();
            for (let i = 0; i <= steps; i++) {
              const u = tail + (head - tail) * (i / steps); const p = pt(u);
              if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
            }
            ctx.stroke();
          }
        },
      });
    }

    /** Colonne verticale qui jaillit du sol (feu, eau, lumière). */
    pillar(x, y, o = {}) {
      const w = o.w ?? 44, h = o.h ?? 180;
      return this.add({
        life: o.life ?? 520, layer: o.layer || 'front', additive: true,
        draw(ctx, k) {
          const grow = SC.ease.outCubic(Math.min(1, k * 4));
          const hh = h * grow, ww = w * (1 - k * 0.5) * (0.85 + 0.15 * Math.sin(k * 30));
          const g = ctx.createLinearGradient(0, y, 0, y - hh);
          g.addColorStop(0, o.color || '#f80'); g.addColorStop(0.6, o.color || '#f80'); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.globalAlpha = (1 - k) * 0.85;
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(x - ww / 2, y); ctx.quadraticCurveTo(x - ww * 0.35, y - hh * 0.6, x - ww * 0.12, y - hh); ctx.lineTo(x + ww * 0.12, y - hh);
          ctx.quadraticCurveTo(x + ww * 0.35, y - hh * 0.6, x + ww / 2, y); ctx.closePath(); ctx.fill();
          ctx.fillStyle = o.core || '#fff'; ctx.globalAlpha = (1 - k) * 0.9;
          ctx.fillRect(x - ww * 0.12, y - hh * 0.95, ww * 0.24, hh * 0.95);
        },
      });
    }

    /** Éclair en zigzag. */
    bolt(x1, y1, x2, y2, o = {}) {
      const segs = 9, pts = [];
      const len = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
      for (let i = 0; i <= segs; i++) {
        const u = i / segs, j = i === 0 || i === segs ? 0 : rnd(-1, 1) * (o.jitter ?? 18);
        pts.push([x1 + (x2 - x1) * u + nx * j, y1 + (y2 - y1) * u + ny * j]);
      }
      return this.add({
        life: o.life ?? 280, layer: o.layer, additive: true,
        draw(ctx, k) {
          ctx.lineJoin = 'round'; ctx.lineCap = 'round';
          const fl = (Math.floor(k * 12) % 2) ? 0.6 : 1;
          for (const [lw, col] of [[(o.width ?? 6) * 2.4, o.color || '#ff0'], [(o.width ?? 6) * 0.6, '#fff']]) {
            ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.globalAlpha = (1 - k) * fl * (lw > 8 ? 0.45 : 1);
            ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
          }
        },
      });
    }

    /** Texte flottant (dégâts, états...). */
    text(x, y, str, o = {}) {
      const size = o.size ?? 22, rise = o.rise ?? 46;
      return this.add({
        life: o.life ?? 950, layer: 'top',
        draw(ctx, k) {
          const pop = k < 0.14 ? SC.ease.outBack(k / 0.14) : 1;
          ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
          ctx.translate(x + (o.dx || 0), Math.max(34, y - rise * SC.ease.outCubic(k)));
          ctx.scale(pop, pop);
          ctx.font = `${o.italic ? 'italic ' : ''}800 ${size}px "Trebuchet MS", "Segoe UI", system-ui, sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = Math.max(3, size / 5); ctx.lineJoin = 'round';
          ctx.strokeStyle = o.outline || 'rgba(8,8,20,0.95)'; ctx.strokeText(str, 0, 0);
          ctx.fillStyle = o.color || '#fff'; ctx.fillText(str, 0, 0);
        },
      });
    }

    /** Nuage de poussière. */
    dust(x, y, o = {}) {
      return this.spark(x, y, { n: o.n ?? 8, color: o.color || '#b9a98c', speed: 0.11, size: 6, life: 520, spread: Math.PI, angle: -Math.PI / 2, additive: false, alpha: 0.5, layer: 'front', gravity: -0.00004, jitter: 14 });
    }

    /**
     * Projectile : va de `from` à `to`, renvoie une Promise résolue à l'arrivée.
     * kind : orb | shuriken | arrow | wave | comet
     */
    projectile(from, to, o = {}) {
      return new Promise(resolve => {
        const dist = Math.hypot(to.x - from.x, to.y - from.y);
        const dur = Math.max(120, dist / (o.speed ?? 1.5));
        const ang = Math.atan2(to.y - from.y, to.x - from.x);
        const trail = [];
        const kind = o.kind || 'orb', col = o.color || '#fff';
        this.add({
          life: dur, additive: true,
          update(dt, it) {
            const k = Math.min(1, it.t / dur), e = kind === 'comet' ? k * k : k;
            it.x = from.x + (to.x - from.x) * e; it.y = from.y + (to.y - from.y) * e;
            trail.push({ x: it.x, y: it.y, a: 1 });
            for (const p of trail) p.a -= dt / (o.trail ?? 220);
            while (trail.length && trail[0].a <= 0) trail.shift();
          },
          draw(ctx, k, it) {
            ctx.lineCap = 'round';
            // traînée
            for (let i = 1; i < trail.length; i++) {
              ctx.globalAlpha = Math.max(0, trail[i].a) * 0.7; ctx.strokeStyle = col; ctx.lineWidth = (o.size ?? 8) * (kind === 'arrow' ? 0.35 : 0.9) * trail[i].a;
              ctx.beginPath(); ctx.moveTo(trail[i - 1].x, trail[i - 1].y); ctx.lineTo(trail[i].x, trail[i].y); ctx.stroke();
            }
            ctx.globalAlpha = 1;
            ctx.save(); ctx.translate(it.x ?? from.x, it.y ?? from.y);
            if (kind === 'orb' || kind === 'comet') {
              const r = (o.size ?? 9) * (kind === 'comet' ? 1.9 : 1);
              const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 2);
              g.addColorStop(0, '#fff'); g.addColorStop(0.35, col); g.addColorStop(1, 'rgba(255,255,255,0)');
              ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 2, 0, 7); ctx.fill();
            } else if (kind === 'shuriken') {
              ctx.rotate(it.t * 0.03); ctx.fillStyle = '#e9ecf8'; ctx.strokeStyle = col; ctx.lineWidth = 2;
              ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 4 : 13; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.stroke();
            } else if (kind === 'arrow') {
              ctx.rotate(ang); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
              ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(10, 0); ctx.stroke();
              ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(-27, -5); ctx.moveTo(-22, 0); ctx.lineTo(-27, 5); ctx.stroke();
              ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(7, -5); ctx.lineTo(7, 5); ctx.closePath(); ctx.fill();
              const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 16); g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,255,255,0)');
              ctx.globalAlpha = 0.5; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(8, 0, 16, 0, 7); ctx.fill();
            } else if (kind === 'wave') {
              ctx.rotate(ang);
              const s = o.size ?? 26;
              ctx.strokeStyle = col; ctx.lineWidth = 7; ctx.globalAlpha = 0.9;
              ctx.beginPath(); ctx.arc(-s * 0.9, 0, s * 1.5, -0.8, 0.8); ctx.stroke();
              ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
              ctx.beginPath(); ctx.arc(-s * 0.9, 0, s * 1.5, -0.8, 0.8); ctx.stroke();
            }
            ctx.restore();
          },
          onEnd: resolve,
        });
      });
    }
  }

  function star(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, rr = i % 2 ? r * 0.35 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  }

  SC.FX = FX;
  SC.rnd = rnd;
})(typeof window !== 'undefined' ? window : globalThis);
