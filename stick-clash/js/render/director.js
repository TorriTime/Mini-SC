/* ============================================================
 * Réalisateur : traduit les événements du moteur en animations.
 *
 * Le moteur attend (await) chaque gestionnaire : ce qui est joué ici
 * cadence donc le combat. Pour changer la « mise en scène » d'un événement,
 * c'est ici (ou dans vfxlib.js / statevisuals.js pour les effets eux-mêmes).
 * ============================================================ */
(function (root) {
  'use strict';
  const SC = root.SC;
  const rnd = SC.rnd;

  class Director {
    constructor(stage, battle) {
      this.stage = stage;
      this.battle = battle;
      const b = battle;
      const on = (t, fn) => b.on(t, e => fn.call(this, e));
      on('battle:start', this.onBattleStart);
      on('round:start', this.onRoundStart);
      on('turn:start', this.onTurnStart);
      on('action:start', this.onActionStart);
      on('attack:begin', this.onAttackBegin);
      on('hit', this.onHit);
      on('death', this.onDeath);
      on('attack:end', this.onAttackEnd);
      on('chain:end', this.onChainEnd);
      on('dot', this.onDot);
      on('heal', this.onHeal);
      on('chakra', this.onChakra);
      on('battle:end', this.onBattleEnd);
    }

    v(u) { return this.stage.view(u); }
    theme(ab) { return SC.elements.get(ab.element || 'neutral'); }
    get fx() { return this.stage.fx; }

    // ---------- cycle de partie ----------
    async onBattleStart() {
      this.stage.banner('COMBAT !', '', '#ffd24a');
      await this.stage.wait(1000);
    }

    async onRoundStart() { await this.stage.wait(120); }

    async onTurnStart(e) {
      this.stage.active = e.unit;
      await this.stage.wait(90);
    }

    // ---------- actions ----------
    async onActionStart(e) {
      const { actor, ability } = e;
      const st = this.stage;
      st.setFocus([actor, ...e.targets]);
      if (ability.type === 'special') {
        const th = this.theme(ability);
        st.banner(ability.name, actor.name, th.main);
        st.flash(th.light, 0.18, 260);
        const av = this.v(actor);
        st.camFocus(av.x, av.y - 60, 1.15);
        await st.wait(480);
      } else if (ability.type === 'defend') {
        this.fx.text(this.v(actor).x, this.v(actor).topY() - 24, 'Concentration', { color: '#bcd6ff', size: 18 });
      }
    }

    async onAttackBegin(e) {
      const { actor, ability, targets, pursuit, combo, chain } = e;
      const st = this.stage, av = this.v(actor);
      const first = targets[0];
      const foe = first && first.side !== actor.side;
      const tv = first ? this.v(first) : null;

      st.addFocus(actor, ...targets);
      if (pursuit) {
        st.setCombo(combo, chain.damage);
        const th = this.theme(ability);
        this.fx.text(av.x, av.topY() - 22, 'POURSUITE !', { color: '#ffd24a', size: 27, rise: 30, life: 1000 });
        this.fx.text(av.x, av.topY() + 4, ability.name, { color: th.light, size: 16, rise: 24, life: 950 });
        this.fx.glow(av.x, av.center().y, { r: 70, color: th.main, life: 320, alpha: 0.7 });
        av.flash = 0.8;
        st.camFocus((av.x + tv.x) / 2, Math.min(av.center().y, tv.center().y) + 25, 1.22);
        await st.wait(170);
      } else if (foe && ability.move === 'melee') {
        st.camFocus((av.x + tv.x) / 2, (av.y + tv.y) / 2 - 50, 1.14);
      } else if (foe) {
        st.camFocus((av.x + tv.x) / 2, (av.y + tv.y) / 2 - 40, 1.04);
      } else if (ability.type !== 'special') {
        st.camReset();
      }

      if (foe && ability.move === 'melee') {
        const dir = tv.x >= av.x ? 1 : -1;
        const gap = 62 * tv.scale;
        const tx = tv.x - dir * gap, ty = tv.y;
        const dist = Math.hypot(tx - av.x, ty - av.y);
        const blink = ability.approach === 'blink';
        av.cancelAnim();
        await av.moveTo(tx, ty, blink ? 140 : Math.max(150, dist / 1.4), { run: true, trail: blink, ease: blink ? 'outCubic' : 'inOutQuad' });
        av.face = dir;
      } else {
        av.face = foe ? (tv.x >= av.x ? 1 : -1) : av.homeFace;
      }
    }

    async onHit(e) {
      const { actor, ability, hit, hitIndex, hitCount, results } = e;
      const st = this.stage, fx = this.fx, av = this.v(actor), th = this.theme(ability);
      const foeRes = results.filter(r => r.target.side !== actor.side);
      const mainTv = this.v(results[0].target);
      const dir = foeRes.length ? (this.v(foeRes[0].target).x >= av.x ? 1 : -1) : av.face;
      if (foeRes.length) av.face = dir;

      if (hitIndex === 0 && ability.vfx.cast) {
        SC.vfx.play('cast', ability.vfx.cast, { fx, stage: st, theme: th, view: av, x: av.x, y: av.center().y });
      }
      const anim = av.playAnim(hit.anim || ability.anim, 1);
      await anim.hit;

      if (ability.vfx.travel && foeRes.length) {
        const from = { x: av.x + av.face * 36 * av.scale, y: av.y - 82 * av.scale };
        await Promise.all(foeRes.map(r => SC.vfx.play('travel', ability.vfx.travel, { fx, theme: th, from, to: this.v(r.target).center() })));
      }

      const size = 0.9 + Math.min(1.6, hit.power) * 0.3;
      await Promise.all(results.map((r, i) => this.impact(e, r, i, results.length, size, th, dir)));

      if (hitIndex === hitCount - 1) await Promise.race([anim.done, st.wait(140)]);
      else await st.wait(40);
    }

    /** Effet d'impact + réaction pour UNE cible. */
    async impact(e, r, i, n, size, th, dir) {
      const { actor, ability, hit } = e;
      const st = this.stage, fx = this.fx;
      const tv = this.v(r.target);
      const c0 = tv.center();
      const name = ability.vfx.impact || (r.damage > 0 ? 'punch' : r.heal > 0 ? 'heal' : null);
      if (name) {
        const p = SC.vfx.play('impact', name, { fx, stage: st, theme: th, x: c0.x, y: c0.y, view: tv, dir, size, crit: r.crit, index: i, count: n });
        if (p && p.then) await p;
      }
      const c = tv.center();
      let line = 0;
      const pop = (txt, o) => fx.text(c.x + (o.dx || 0), tv.topY() - 62 - line++ * 16, txt, o);

      if (r.damage > 0) {
        st.tween(r.target, 'shownHp', r.hpAfter, 260);
        const big = r.crit ? 34 : 22 + Math.min(12, r.damage / 25);
        fx.text(c.x + rnd(-12, 12), c.y - 24, String(r.damage), { color: r.crit ? '#ffd24a' : '#ffffff', size: big, rise: 56, italic: r.crit });
        if (r.crit) fx.text(c.x, c.y - 56, 'CRITIQUE !', { color: '#ffb347', size: 15, rise: 40 });
        if (!r.killed) {
          if (r.state) SC.enterState(tv, r.state, st); else tv.hurt(Math.min(1.2, 0.6 + r.damage / 300));
        }
        if (i === 0) {
          const heavy = r.crit || hit.power >= 1.2 || !!r.state;
          st.shake(heavy ? 7 : 3, heavy ? 170 : 90);
          st.hitStop(heavy ? 85 : 45);
        }
        if (r.lifesteal > 0) {
          const av = this.v(actor);
          fx.text(av.x, av.topY(), `+${r.lifesteal}`, { color: '#7dffa8', size: 20 });
          st.tween(actor, 'shownHp', actor.hp, 260);
        }
      }
      if (r.state && r.damage > 0 && !r.killed && n === 1) {
        const s = SC.states.get(r.state);
        fx.text(c.x, tv.topY() - 66, s.name.toUpperCase() + ' !', { color: s.color, size: 17, rise: 30, life: 1000 });
      }
      if (r.heal > 0) {
        st.tween(r.target, 'shownHp', r.hpAfter, 320);
        fx.text(c.x + rnd(-8, 8), c.y - 20, `+${r.heal}`, { color: '#7dffa8', size: 24, rise: 50 });
      }
      if (r.chakra) fx.text(c.x + 22, c.y - 6, `${r.chakra > 0 ? '+' : ''}${r.chakra} CK`, { color: '#6cc8ff', size: 15, rise: 36 });
      if (r.cleansed) pop('Purifié', { color: '#e8fff0', size: 14, life: 900 });
      for (const b of r.buffs) {
        const d = SC.buffs.get(b.id);
        pop(d.name, { color: d.color, size: 14, life: 1000 });
      }
    }

    async onDeath(e) {
      const st = this.stage, v = this.v(e.unit);
      v.dead = true; v.cancelAnim();
      v.setBase('down', 0.03); v.hurt(1);
      const c = v.center();
      this.fx.spark(c.x, c.y, { n: 28, color: e.unit.def.look.color, speed: 0.45, size: 4, life: 800, gravity: 0.0005 });
      this.fx.ring(c.x, c.y, { r0: 10, r1: 110, color: '#fff', life: 500, width: 6 });
      this.fx.text(v.x, v.topY() - 12, 'K.O.', { color: '#ff8a8a', size: 32, rise: 40, life: 1200 });
      st.tween(e.unit, 'shownHp', 0, 200);
      st.shake(9, 220); st.hitStop(130);
      await st.wait(380);
      st.tween(v, 'alpha', 0, 700);
    }

    async onAttackEnd(e) {
      const { actor, ability } = e;
      const av = this.v(actor);
      if (ability.move === 'melee' && !actor.state) {
        const d = Math.hypot(av.homeX - av.x, av.homeY - av.y);
        if (d > 4) av.moveTo(av.homeX, av.homeY, Math.max(180, d / 0.95), { run: true, endFace: av.homeFace }); // sans attendre
      }
    }

    async onChainEnd(e) {
      const st = this.stage;
      if (e.combo >= 2) {
        st.setCombo(e.combo, e.damage);
        await st.wait(420);
      } else await st.wait(70);
      st.setFocus(null); // tout le monde réapparaît pendant le retour en place
      await Promise.all([...st.views.values()].map(v => SC.recoverView(v, st)));
      for (const u of this.battle.units) { st.tween(u, 'shownHp', u.hp, 120); }
      st.camReset();
      st.endCombo();
    }

    async onDot(e) {
      const st = this.stage, v = this.v(e.unit), c = v.center();
      const col = e.buff ? SC.buffs.get(e.buff.id).color : '#fff';
      st.tween(e.unit, 'shownHp', e.hpAfter, 240);
      this.fx.text(c.x, c.y - 20, String(e.amount), { color: col, size: 22 });
      v.hurt(0.5);
      await st.wait(e.killed ? 120 : 330);
    }

    async onHeal(e) {
      const st = this.stage, v = this.v(e.unit), c = v.center();
      st.tween(e.unit, 'shownHp', e.hpAfter, 300);
      this.fx.text(c.x, c.y - 20, `+${e.amount}`, { color: '#7dffa8', size: 20 });
      this.fx.spark(c.x, c.y, { n: 6, color: '#8dffb5', shape: 'star', speed: 0.08, life: 700, angle: -Math.PI / 2, spread: 1.2, jitter: 18 });
      await st.wait(260);
    }

    async onChakra(e) {
      const v = this.v(e.unit);
      this.fx.text(v.x + 26, v.center().y, `+${e.amount} CK`, { color: '#6cc8ff', size: 14, rise: 34 });
    }

    async onBattleEnd(e) {
      const st = this.stage;
      st.active = null;
      st.camReset();
      for (const u of this.battle.units) if (u.alive && e.winner === u.side) this.v(u).setBase('victory', 0.02);
      await st.wait(700);
    }
  }

  SC.Director = Director;
})(typeof window !== 'undefined' ? window : globalThis);
