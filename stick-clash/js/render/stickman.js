/* ============================================================
 * Stickman : squelette, accessoires (registre) et vue animée.
 *
 * Ajouter un accessoire : SC.looks.register({ id, layer, draw(A) })
 *   layer : 'back' (derrière le corps) | 'head' | 'hand'
 *   A     : { ctx, J (articulations), p (pose), col, acc, time, flash, look }
 * Les coordonnées sont locales, le personnage regarde vers +x.
 * ============================================================ */
(function (root) {
  'use strict';
  const SC = root.SC;
  const SK = (SC.SKEL = { hip: 44, torso: 34, head: 11, upArm: 17, loArm: 17, upLeg: 22, loLeg: 22, thick: 5 });
  SC.looks = new SC.Registry('accessoire');

  // ---------- couleurs ----------
  function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(c1, c2, t) {
    const a = hex(c1), b = hex(c2);
    return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
  }
  SC.mixColor = mix;

  const rot = (o, a, dx, dy) => [o[0] + dx * Math.cos(a) - dy * Math.sin(a), o[1] + dx * Math.sin(a) + dy * Math.cos(a)];
  const seg = (o, a, l) => [o[0] + Math.sin(a) * l, o[1] + Math.cos(a) * l];

  function joints(p) {
    const S = SK;
    const sh = [Math.sin(p.torso) * S.torso * 0.92, -Math.cos(p.torso) * S.torso * 0.92];
    const neck = [Math.sin(p.torso) * S.torso, -Math.cos(p.torso) * S.torso];
    const ha = p.torso + p.head;
    const head = [neck[0] + Math.sin(ha) * (S.head + 1), neck[1] - Math.cos(ha) * (S.head + 1)];
    const hip = [0, 0];
    const lE = seg(sh, p.laU, S.upArm), lH = seg(lE, p.laL, S.loArm);
    const rE = seg(sh, p.raU, S.upArm), rH = seg(rE, p.raL, S.loArm);
    const lK = seg(hip, p.llU, S.upLeg), lF = seg(lK, p.llL, S.loLeg);
    const rK = seg(hip, p.rlU, S.upLeg), rF = seg(rK, p.rlL, S.loLeg);
    return { hip, sh, neck, head, ha, lE, lH, rE, rH, lK, lF, rK, rF };
  }

  // ---------- accessoires ----------
  const L = (id, layer, draw) => SC.looks.register({ id, layer, draw });
  const line = (ctx, pts) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke(); };

  L('headband', 'head', A => {
    const { ctx, J, time } = A, h = J.head, a = J.ha;
    const p1 = rot(h, a, -11, -3), p2 = rot(h, a, 11.5, -3);
    ctx.strokeStyle = A.acc; ctx.lineWidth = 3;
    line(ctx, [p1, p2]);
    const w = Math.sin(time / 110) * 3;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.quadraticCurveTo(p1[0] - 10, p1[1] + 1 + w, p1[0] - 19, p1[1] + 6 + w * 1.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p1[0], p1[1] + 1); ctx.quadraticCurveTo(p1[0] - 9, p1[1] + 6 + w, p1[0] - 16, p1[1] + 12 + w * 1.4); ctx.stroke();
  });

  L('hair-spiky', 'head', A => {
    const { ctx, J } = A, h = J.head, a = J.ha;
    ctx.strokeStyle = A.col; ctx.lineWidth = 3.4;
    [[-1.9, 10], [-1.4, 13], [-0.9, 12], [-0.45, 9]].forEach(([ang, len]) => {
      const base = rot(h, a, Math.cos(ang) * 10.5, Math.sin(ang) * 10.5);
      const tip = rot(h, a, Math.cos(ang) * (10.5 + len), Math.sin(ang) * (10.5 + len));
      line(ctx, [base, tip]);
    });
  });

  L('hair-pony', 'head', A => {
    const { ctx, J, time } = A, h = J.head, a = J.ha;
    const root0 = rot(h, a, -9, -5), w = Math.sin(time / 140) * 3;
    ctx.strokeStyle = A.col; ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(root0[0], root0[1]);
    ctx.quadraticCurveTo(root0[0] - 14, root0[1] - 4 + w, root0[0] - 20, root0[1] + 10 + w * 1.5); ctx.stroke();
    ctx.strokeStyle = A.acc; ctx.lineWidth = 3; line(ctx, [rot(h, a, -9, -8), rot(h, a, -9, -2)]);
  });

  L('hair-long', 'back', A => {
    const { ctx, J, time } = A, h = J.head, a = J.ha;
    const w = Math.sin(time / 170) * 2.5;
    ctx.strokeStyle = A.col; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(h[0] - 3, h[1] - 4);
    ctx.quadraticCurveTo(h[0] - 18 + w, h[1] + 6, h[0] - 15 + w * 1.5, h[1] + 28); ctx.stroke();
  });

  L('helmet', 'head', A => {
    const { ctx, J } = A, h = J.head, a = J.ha;
    ctx.strokeStyle = A.acc; ctx.lineWidth = 4.5;
    ctx.beginPath(); ctx.arc(h[0], h[1], 11.5, a - Math.PI, a); ctx.stroke();
    ctx.lineWidth = 3; line(ctx, [rot(h, a, 0, -11), rot(h, a, 0, -19)]);
    line(ctx, [rot(h, a, 11.5, 0), rot(h, a, 11.5, 6)]);
  });

  L('hood', 'head', A => {
    const { ctx, J, time } = A, h = J.head, a = J.ha;
    ctx.fillStyle = A.dark;
    ctx.strokeStyle = A.col; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(h[0], h[1], 12.5, a - Math.PI * 1.08, a + 0.15);
    const tip = rot(h, a, -21, 9 + Math.sin(time / 150) * 2);
    ctx.quadraticCurveTo(h[0] - 8, h[1] + 12, tip[0], tip[1]);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = A.acc; const e = rot(h, a, 5.2, -1.2);
    ctx.beginPath(); ctx.arc(e[0], e[1], 1.8, 0, 7); ctx.fill();
  });

  L('halo', 'head', A => {
    const { ctx, J, time } = A, h = J.head;
    ctx.strokeStyle = A.acc; ctx.lineWidth = 2.5; ctx.globalAlpha *= 0.9;
    ctx.beginPath(); ctx.ellipse(h[0], h[1] - 18, 11, 3.5, Math.sin(time / 400) * 0.1, 0, 7); ctx.stroke();
    ctx.globalAlpha /= 0.9;
  });

  L('wizard-hat', 'head', A => {
    const { ctx, J, time } = A, h = J.head, a = J.ha;
    const l = rot(h, a, -15, -6), r = rot(h, a, 15, -6);
    const tip = rot(h, a, -12 + Math.sin(time / 300) * 2, -36);
    ctx.fillStyle = A.col; ctx.strokeStyle = A.dark; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.quadraticCurveTo(h[0] - 2, h[1] - 14, tip[0], tip[1]);
    ctx.quadraticCurveTo(h[0] + 8, h[1] - 14, r[0], r[1]); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = A.acc; ctx.lineWidth = 3; line(ctx, [l, r]);
    const s = rot(h, a, -2, -17); ctx.fillStyle = A.acc; ctx.beginPath(); ctx.arc(s[0], s[1], 2.4, 0, 7); ctx.fill();
  });

  L('scarf', 'back', A => {
    const { ctx, J, time } = A, n = J.neck;
    ctx.strokeStyle = A.acc; ctx.lineCap = 'round';
    const w = Math.sin(time / 120) * 4;
    ctx.lineWidth = 4.2;
    ctx.beginPath(); ctx.moveTo(n[0], n[1] + 2); ctx.bezierCurveTo(n[0] - 12, n[1] + 2 + w, n[0] - 22, n[1] + 8 - w, n[0] - 32, n[1] + 6 + w); ctx.stroke();
    ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.moveTo(n[0], n[1] + 4); ctx.bezierCurveTo(n[0] - 10, n[1] + 9 - w, n[0] - 19, n[1] + 14 + w, n[0] - 27, n[1] + 16 - w); ctx.stroke();
  });

  L('mask', 'head', A => {
    const { ctx, J } = A, h = J.head, a = J.ha;
    ctx.strokeStyle = A.acc; ctx.lineWidth = 4;
    line(ctx, [rot(h, a, -9, 3.5), rot(h, a, 10, 3.5)]);
  });

  L('sword', 'hand', A => {
    const { ctx, J, p } = A, h = J.rH, a = p.raL, d = [Math.sin(a), Math.cos(a)], n = [d[1], -d[0]];
    const b0 = [h[0] - d[0] * 5, h[1] - d[1] * 5], b1 = [h[0] + d[0] * 40, h[1] + d[1] * 40];
    ctx.lineCap = 'round';
    ctx.strokeStyle = A.acc; ctx.globalAlpha *= 0.28; ctx.lineWidth = 8; line(ctx, [b0, b1]); ctx.globalAlpha /= 0.28;
    ctx.strokeStyle = '#f4f7ff'; ctx.lineWidth = 3; line(ctx, [b0, b1]);
    ctx.strokeStyle = A.acc; ctx.lineWidth = 3; line(ctx, [[h[0] + d[0] * 4 + n[0] * 5, h[1] + d[1] * 4 + n[1] * 5], [h[0] + d[0] * 4 - n[0] * 5, h[1] + d[1] * 4 - n[1] * 5]]);
  });

  L('kunai', 'hand', A => {
    const { ctx, J, p } = A, h = J.rH, a = p.raL, d = [Math.sin(a), Math.cos(a)];
    ctx.lineCap = 'round'; ctx.strokeStyle = '#e8eaf5'; ctx.lineWidth = 2.6;
    line(ctx, [h, [h[0] + d[0] * 17, h[1] + d[1] * 17]]);
    ctx.strokeStyle = A.acc; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(h[0] - d[0] * 4, h[1] - d[1] * 4, 3, 0, 7); ctx.stroke();
  });

  L('staff', 'hand', A => {
    const { ctx, J, p } = A, h = J.rH, a = p.raL + Math.PI / 2, d = [Math.sin(a), Math.cos(a)];
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#b98a54'; ctx.lineWidth = 3.4; line(ctx, [[h[0] - d[0] * 26, h[1] - d[1] * 26], [h[0] + d[0] * 46, h[1] + d[1] * 46]]);
    ctx.fillStyle = A.acc; const t = [h[0] + d[0] * 48, h[1] + d[1] * 48];
    ctx.beginPath(); ctx.arc(t[0], t[1], 4.2, 0, 7); ctx.fill();
  });

  L('bow', 'hand', A => {
    const { ctx, J, p } = A, h = J.rH, a = p.raL, d = [Math.sin(a), Math.cos(a)], n = [Math.cos(a), -Math.sin(a)];
    const top = [h[0] + n[0] * 24, h[1] + n[1] * 24], bot = [h[0] - n[0] * 24, h[1] - n[1] * 24];
    ctx.lineCap = 'round'; ctx.strokeStyle = '#c9965a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.quadraticCurveTo(h[0] + d[0] * 20, h[1] + d[1] * 20, bot[0], bot[1]); ctx.stroke();
    ctx.strokeStyle = '#f4f7ff'; ctx.lineWidth = 1.2;
    const pull = p.laU < -1;
    ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.lineTo(pull ? J.lH[0] : h[0], pull ? J.lH[1] : h[1]); ctx.lineTo(bot[0], bot[1]); ctx.stroke();
    if (pull) { ctx.strokeStyle = A.acc; ctx.lineWidth = 2; line(ctx, [J.lH, [h[0] + d[0] * 10, h[1] + d[1] * 10]]); }
  });

  L('orb', 'hand', A => {
    const { ctx, J, p, time } = A, h = J.rH;
    const up = p.raU > 1.9, r = (up ? 8.5 : 5.5) + Math.sin(time / 120) * 1.2;
    const c = [h[0] + 3, h[1] - (up ? 10 : 6)];
    const g = ctx.createRadialGradient(c[0], c[1], 1, c[0], c[1], r * 2.2);
    g.addColorStop(0, A.acc); g.addColorStop(0.35, A.col); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha *= 0.85; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c[0], c[1], r * 2.2, 0, 7); ctx.fill(); ctx.globalAlpha /= 0.85;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(c[0], c[1], r * 0.45, 0, 7); ctx.fill();
  });

  L('gloves', 'hand', A => {
    const { ctx, J, look } = A, r = look.gloveSize || 5.8;
    ctx.fillStyle = A.acc;
    [J.rH, J.lH].forEach(h => { ctx.beginPath(); ctx.arc(h[0], h[1], r, 0, 7); ctx.fill(); });
  });

  // ---------- dessin ----------
  function drawStickman(ctx, o) {
    const look = o.look, p = o.pose;
    const f = o.flash || 0;
    const base = o.ghost || look.color;
    const col = f ? mix(base, '#ffffff', Math.min(1, f)) : base;
    const back = o.ghost ? base : mix(look.color, '#000000', 0.32);
    const backCol = f ? mix(look.color, '#ffffff', Math.min(1, f) * 0.8) : back;
    const J = joints(p);
    const A = {
      ctx, J, p, look, col: o.ghost ? base : look.color, acc: o.ghost ? base : look.accent,
      dark: o.ghost ? base : mix(look.color, '#000000', 0.55), time: o.time || 0, flash: f,
    };
    const parts = look.parts.map(id => SC.looks.get(id));

    ctx.save();
    ctx.globalAlpha *= o.alpha ?? 1;
    ctx.translate(o.x, o.y);
    ctx.scale(o.face * o.scale, o.scale);
    ctx.translate(p.rx, p.ry - SK.hip);
    ctx.rotate(p.rr);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    parts.filter(d => d.layer === 'back').forEach(d => { ctx.save(); d.draw(A); ctx.restore(); });

    ctx.lineWidth = SK.thick;
    ctx.strokeStyle = backCol;                      // membres arrière
    line(ctx, [J.sh, J.lE, J.lH]);
    line(ctx, [J.hip, J.lK, J.lF]);
    ctx.strokeStyle = col;                          // buste + jambe avant
    line(ctx, [J.hip, J.neck]);
    line(ctx, [J.hip, J.rK, J.rF]);
    // tête
    ctx.fillStyle = o.ghost ? 'rgba(0,0,0,0)' : '#10131f';
    ctx.lineWidth = 4.2;
    ctx.beginPath(); ctx.arc(J.head[0], J.head[1], SK.head, 0, 7); ctx.fill(); ctx.stroke();
    if (!o.ghost) { // œil
      const e = rot(J.head, J.ha, 4.6, -1.4);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(e[0], e[1], 1.7, 0, 7); ctx.fill();
    }
    parts.filter(d => d.layer === 'head').forEach(d => { ctx.save(); d.draw(A); ctx.restore(); });
    ctx.lineWidth = SK.thick; ctx.strokeStyle = col; // bras avant
    line(ctx, [J.sh, J.rE, J.rH]);
    parts.filter(d => d.layer === 'hand').forEach(d => { ctx.save(); d.draw(A); ctx.restore(); });
    ctx.restore();
  }
  SC.drawStickman = drawStickman;

  // ---------- vue animée ----------
  class StickView {
    constructor(look) {
      this.look = look;
      this.x = 0; this.y = 0; this.face = 1; this.scale = 1;
      this.homeX = 0; this.homeY = 0; this.homeFace = 1;
      this.pose = Object.assign({}, SC.poseOf('idle'));
      this.base = 'idle';
      this.settle = 0.014;
      this.alpha = 1; this.flash = 0; this.flinch = 0;
      this.t = Math.random() * 1000;
      this.task = null; this.mv = null;
      this.running = false; this.runPhase = 0;
      this.trail = []; this.trailAcc = 0;
      this.dead = false;
    }

    setBase(name, rate) { this.base = name; this.settle = rate || 0.014; }
    basePose() { return SC.poseOf(this.base); }

    /** Fait « encaisser » le personnage (fonctionne quelle que soit la pose de base). */
    hurt(power = 1) { this.flinch = Math.min(1.2, power); this.flash = 1; }

    /** Hauteur apparente du centre du corps (pour placer les impacts). */
    center() {
      const p = this.pose;
      return { x: this.x + this.face * p.rx * this.scale * 0.5, y: this.y - (SK.hip + 14 - p.ry * 0.9) * this.scale * (Math.abs(p.rr) > 0.8 ? 0.45 : 1) };
    }
    topY() { return this.y - 118 * this.scale + Math.min(0, this.pose.ry) * this.scale; }

    playAnim(name, speed = 1) {
      const def = SC.anims.get(name);
      this.cancelAnim();
      let hitRes, doneRes;
      const hit = new Promise(r => (hitRes = r)), done = new Promise(r => (doneRes = r));
      this.task = { steps: def.steps, i: -1, t: 0, d: 0, from: null, to: null, ease: null, hitRes, doneRes, speed, hitStep: false };
      this._nextStep();
      return { hit, done };
    }

    cancelAnim() {
      const t = this.task;
      if (t) { this.task = null; t.hitRes(); t.doneRes(); }
    }

    _target(step) { return step.p === '$base' ? this.basePose() : SC.poseOf(step.p); }

    _nextStep() {
      const t = this.task;
      t.i++;
      if (t.i >= t.steps.length) { this.task = null; t.hitRes(); t.doneRes(); return; }
      const s = t.steps[t.i];
      t.from = Object.assign({}, this.pose);
      t.to = this._target(s);
      t.d = s.d / t.speed; t.t = 0; t.hitStep = !!s.hit;
      t.ease = SC.ease[s.ease || 'outQuad'];
    }

    moveTo(x, y, ms, o = {}) {
      this.cancelMove();
      return new Promise(res => {
        const dx = x - this.x;
        if (o.faceMove !== false && Math.abs(dx) > 8) this.face = dx > 0 ? 1 : -1;
        this.mv = { x0: this.x, y0: this.y, x1: x, y1: y, t: 0, d: Math.max(1, ms), ease: SC.ease[o.ease || 'inOutQuad'], res, run: !!o.run, trail: !!o.trail, endFace: o.endFace };
        this.running = !!o.run;
      });
    }

    cancelMove() {
      const m = this.mv;
      if (m) { this.mv = null; this.running = false; m.res(); }
    }

    update(dt) {
      this.t += dt;
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt / 140);
      if (this.flinch > 0) this.flinch = Math.max(0, this.flinch - dt / 230);

      // déplacement
      const m = this.mv;
      if (m) {
        m.t += dt;
        const k = Math.min(1, m.t / m.d), e = m.ease(k);
        this.x = m.x0 + (m.x1 - m.x0) * e;
        this.y = m.y0 + (m.y1 - m.y0) * e;
        if (this.running) this.runPhase += dt * 0.022;
        if (m.trail) {
          this.trailAcc += dt;
          if (this.trailAcc > 26) { this.trailAcc = 0; this.trail.push({ pose: this.renderPose(), x: this.x, y: this.y, face: this.face, a: 0.55 }); }
        }
        if (k >= 1) {
          this.mv = null; this.running = false;
          if (m.endFace) this.face = m.endFace;
          m.res();
        }
      }
      for (const g of this.trail) g.a -= dt / 280;
      if (this.trail.length) this.trail = this.trail.filter(g => g.a > 0);

      // pose
      const task = this.task;
      if (task) {
        task.t += dt;
        const k = task.d <= 0 ? 1 : Math.min(1, task.t / task.d);
        if (task.steps[task.i].p === '$base') task.to = this.basePose();
        const e = task.ease(k);
        for (const key of SC.POSE_KEYS) this.pose[key] = task.from[key] + (task.to[key] - task.from[key]) * e;
        if (k >= 1) {
          if (task.hitStep) { task.hitStep = false; task.hitRes(); }
          this._nextStep();
        }
      } else {
        const target = this.running ? this.runTarget() : this.basePose();
        const k = 1 - Math.exp(-dt * (this.running ? 0.06 : this.settle));
        for (const key of SC.POSE_KEYS) this.pose[key] += (target[key] - this.pose[key]) * k;
      }
    }

    runTarget() {
      const s = Math.sin(this.runPhase), c = Math.cos(this.runPhase);
      const p = Object.assign({}, SC.poseOf('idle'));
      p.torso = 0.42; p.rx = 6;
      p.rlU = s * 1.1;  p.rlL = p.rlU - 0.35 - 0.9 * Math.max(0, c);
      p.llU = -s * 1.1; p.llL = p.llU - 0.35 - 0.9 * Math.max(0, -c);
      p.raU = -s * 1.0 + 0.1; p.raL = p.raU + 1.3;
      p.laU = s * 1.0 + 0.1;  p.laL = p.laU + 1.3;
      p.ry = -Math.abs(Math.sin(this.runPhase)) * 4;
      return p;
    }

    /** Pose réellement dessinée = pose animée + micro-mouvements procéduraux. */
    renderPose() {
      const p = Object.assign({}, this.pose);
      if (!this.task && !this.running) {
        if (this.base === 'idle') {
          const s = Math.sin(this.t / 250);
          p.ry += s * 1.3; p.torso += s * 0.015; p.raU += s * 0.04; p.laU -= s * 0.04;
        } else if (this.base === 'air') {
          p.ry += Math.sin(this.t / 180) * 5; p.rr += Math.sin(this.t / 260) * 0.06;
          p.raU += Math.sin(this.t / 150) * 0.12; p.llU += Math.sin(this.t / 170) * 0.15;
        } else if (this.base === 'low') {
          p.ry += Math.sin(this.t / 160) * 3;
        }
      }
      const f = this.flinch;
      if (f > 0) {
        p.rx -= 12 * f; p.torso -= 0.35 * f; p.head -= 0.25 * f; p.raU -= 0.5 * f; p.laU -= 0.5 * f;
        p.rx += Math.sin(this.t * 0.9) * 2.5 * f;
      }
      return p;
    }

    draw(ctx) {
      for (const g of this.trail) {
        ctx.save(); ctx.globalAlpha = g.a * (this.alpha);
        drawStickman(ctx, { look: this.look, x: g.x, y: g.y, face: g.face, scale: this.scale, pose: g.pose, ghost: this.look.accent, time: this.t });
        ctx.restore();
      }
      drawStickman(ctx, { look: this.look, x: this.x, y: this.y, face: this.face, scale: this.scale, pose: this.renderPose(), flash: this.flash, alpha: this.alpha, time: this.t });
    }
  }
  SC.StickView = StickView;
})(typeof window !== 'undefined' ? window : globalThis);
