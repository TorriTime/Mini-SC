/* ============================================================
 * Moteur de combat (aucune dépendance au rendu).
 *
 * Le moteur résout les règles et ÉMET DES ÉVÉNEMENTS en les attendant
 * (await) : un « réalisateur » (render/director.js) s'y abonne pour les
 * jouer en animation. Sans abonné, un combat complet se résout instantanément
 * (c'est ce qu'utilisent les tests).
 *
 * Événements : battle:start, round:start, turn:start, action:start,
 *   attack:begin, hit, death, attack:end, chain:end, dot, heal, chakra,
 *   buff:end, turn:end, round:end, battle:end
 *
 * Chaîne de combo :
 *   action initiale -> (poursuite -> poursuite -> ...) -> chain:end
 *   Une poursuite se déclenche quand un ennemi a un état listé dans ses
 *   `triggers`. Elle consomme l'état, frappe, et peut en infliger un nouveau.
 *   Chaque personnage ne poursuit qu'une fois par chaîne ; l'ordre de priorité
 *   suit l'emplacement dans la formation (0 d'abord).
 * ============================================================ */
(function (root) {
  'use strict';
  const SC = root.SC;
  const R = () => SC.rules;

  class Battle {
    /**
     * @param {object} o  { teamA:[ids], teamB:[ids], seed, controllers:{A,B}, inputProvider }
     */
    constructor(o) {
      this.seed = (o.seed ?? Math.floor(Math.random() * 2 ** 32)) >>> 0;
      this.rng = new SC.Random(this.seed);
      this.controllers = Object.assign({ A: 'ai', B: 'ai' }, o.controllers);
      this.inputProvider = o.inputProvider || null;
      this.listeners = {};
      this.teams = { A: [], B: [] };
      this.units = [];
      for (const side of ['A', 'B']) {
        (o['team' + side] || []).forEach((cid, slot) => {
          const u = new SC.Unit(SC.characters.get(cid), side, slot, this);
          this.teams[side].push(u);
          this.units.push(u);
        });
      }
      this.round = 0;
      this.over = false;
      this.winner = null;
      this.chain = null;
      this.chainSeq = 0;
    }

    // ---------- événements ----------
    on(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); return this; }

    async emit(type, payload = {}) {
      payload.type = type;
      const hs = [...(this.listeners[type] || []), ...(this.listeners['*'] || [])];
      for (const h of hs) {
        try { await h(payload, type); } catch (e) { console.error(`[battle] gestionnaire "${type}" :`, e); }
      }
    }

    // ---------- accès ----------
    alive(side) { return this.teams[side].filter(u => u.alive); }
    foesOf(unit) { return this.alive(unit.side === 'A' ? 'B' : 'A'); }
    alliesOf(unit) { return this.alive(unit.side); }

    /** Les cibles qu'un joueur peut choisir pour cette capacité (null = pas de choix). */
    candidateTargets(unit, ab) {
      if (ab.target === 'enemy') return this.foesOf(unit);
      if (ab.target === 'ally') return this.alliesOf(unit);
      return [null];
    }

    resolveTargets(actor, ab, chosen) {
      switch (ab.target) {
        case 'self': return [actor];
        case 'allies': return this.alliesOf(actor);
        case 'enemies': return this.foesOf(actor);
        case 'ally': return [chosen && chosen.alive && chosen.side === actor.side ? chosen : actor];
        default: {
          const foes = this.foesOf(actor);
          return [chosen && chosen.alive && chosen.side !== actor.side ? chosen : foes[0]].filter(Boolean);
        }
      }
    }

    isValidChoice(unit, c) {
      if (!c || !c.ability || !unit.actions.includes(c.ability)) return false;
      if (!unit.canUse(c.ability).ok) return false;
      const cands = this.candidateTargets(unit, c.ability);
      return cands[0] === null || cands.includes(c.target);
    }

    // ---------- déroulement ----------
    turnOrder() {
      return this.units
        .filter(u => u.alive)
        .sort((a, b) => b.stat('spd') - a.stat('spd') || a.slot - b.slot || (a.side < b.side ? -1 : 1));
    }

    async run() {
      await this.emit('battle:start', {});
      for (const u of this.units) await this.trigger('onBattleStart', u);
      while (!this.over) {
        this.round++;
        if (this.round > R().maxRounds) { this.endByTimeout(); break; }
        const order = this.turnOrder();
        await this.emit('round:start', { round: this.round, order });
        for (const u of order) {
          if (this.over) break;
          if (!u.alive) continue;
          await this.takeTurn(u, order);
        }
        if (!this.over) await this.emit('round:end', { round: this.round });
      }
      await this.emit('battle:end', { winner: this.winner, round: this.round });
      return this.winner;
    }

    endByTimeout() {
      const pct = s => this.teams[s].reduce((a, u) => a + u.hp / u.maxHp, 0);
      const a = pct('A'), b = pct('B');
      this.winner = Math.abs(a - b) < 1e-9 ? 'draw' : a > b ? 'A' : 'B';
      this.over = true;
    }

    checkEnd() {
      if (this.over) return true;
      const a = this.alive('A').length, b = this.alive('B').length;
      if (a === 0 || b === 0) {
        this.winner = a === 0 && b === 0 ? 'draw' : a === 0 ? 'B' : 'A';
        this.over = true;
      }
      return this.over;
    }

    async takeTurn(unit, order) {
      unit.startTurn();
      await this.emit('turn:start', { unit, order, round: this.round });

      // Effets de début de tour (poisons, brûlures, passifs), puis décompte des durées
      for (const b of [...unit.buffs]) {
        const d = SC.buffs.get(b.id);
        if (d.onTurnStart && unit.alive) await d.onTurnStart(this, unit, b);
      }
      await this.trigger('onTurnStart', unit);
      if (unit.alive) {
        for (const b of unit.tickBuffs()) await this.emit('buff:end', { unit, id: b.id });
      }
      if (this.checkEnd() || !unit.alive) return;

      const choice = await this.chooseAction(unit);
      await this.performAction(unit, choice.ability, choice.target);
      await this.emit('turn:end', { unit });
    }

    async chooseAction(unit) {
      let choice = null;
      if (this.controllers[unit.side] === 'human' && this.inputProvider) {
        choice = await this.inputProvider(unit, this);
      }
      if (!this.isValidChoice(unit, choice)) choice = SC.AI.choose(this, unit);
      return choice;
    }

    // ---------- action + chaîne de poursuites ----------
    async performAction(actor, ability, chosen) {
      const chain = {
        id: ++this.chainSeq, actor, actions: 0, damage: 0, hits: 0,
        pursuers: new Set([actor]), affected: new Set(), last: null,
      };
      this.chain = chain;
      const targets = this.resolveTargets(actor, ability, chosen);

      await this.emit('action:start', { actor, ability, targets, chain });
      actor.spend(ability);
      await this.runAbility(actor, ability, targets, chain, false);
      if (ability.type === 'normal') {
        const g = actor.gainChakra(R().chakraOnNormal);
        if (g) await this.emit('chakra', { unit: actor, amount: g });
      }

      // Poursuites en cascade
      while (!this.checkEnd() && chain.actions < R().maxChainLength) {
        const p = this.findPursuit(actor.side, chain, u => u.state);
        if (!p) break;
        chain.pursuers.add(p.pursuer);
        p.target.state = null; // l'état est consommé
        await this.runAbility(p.pursuer, p.pursuit, [p.target], chain, true);
      }

      // Fin de chaîne : tous les états retombent
      for (const u of this.units) u.state = null;
      this.chain = null;
      await this.emit('chain:end', { chain, actor, combo: chain.actions, damage: chain.damage });
      this.checkEnd();
    }

    /**
     * Prochaine poursuite possible pour l'équipe `side`.
     * Fonction pure sur `stateOf` : sert aussi à prévisualiser (IA, interface).
     */
    findPursuit(side, chain, stateOf) {
      const team = this.alive(side).slice().sort((a, b) => a.slot - b.slot);
      const foes = this.alive(side === 'A' ? 'B' : 'A');
      for (const p of team) {
        if (chain.pursuers.has(p)) continue;
        for (const pu of p.pursuits) {
          const m = foes.filter(f => pu.triggers.includes(stateOf(f)));
          if (m.length) return { pursuer: p, pursuit: pu, target: m.find(f => f === chain.last) || m[0] };
        }
      }
      return null;
    }

    /** Prévisualise la chaîne probable d'une action (états sûrs ou probables uniquement). */
    previewChain(actor, ability, chosen) {
      const targets = this.resolveTargets(actor, ability, chosen).filter(t => t.side !== actor.side);
      const states = new Map();
      let uncertain = false;
      const stateLabel = h => {
        const c = h.stateChance ?? 1;
        if (!h.state || c < 0.4) return null;
        if (c < 1) uncertain = true;
        return h.state;
      };
      for (const h of ability.hits) { const s = stateLabel(h); if (s) targets.forEach(t => states.set(t, s)); }
      const chain = { pursuers: new Set([actor]), last: targets[0] || null, actions: 1 };
      const steps = [];
      while (targets.length && chain.actions < R().maxChainLength) {
        const p = this.findPursuit(actor.side, chain, u => states.get(u) || null);
        if (!p) break;
        chain.pursuers.add(p.pursuer);
        chain.actions++;
        chain.last = p.target;
        let next = null;
        for (const h of p.pursuit.hits) { const s = stateLabel(h); if (s) next = s; }
        states.set(p.target, next);
        const power = p.pursuit.hits.reduce((a, h) => a + h.power, 0);
        const estimate = R().damageScale * p.pursuer.stat('atk') * power * (R().defenseConstant / (R().defenseConstant + p.target.stat('def')));
        steps.push({ pursuer: p.pursuer, pursuit: p.pursuit, target: p.target, estimate });
      }
      return { steps, uncertain, targets };
    }

    /** Joue une capacité (action initiale ou poursuite) : approche, coups, morts. */
    async runAbility(actor, ability, targets, chain, isPursuit) {
      chain.actions++;
      await this.emit('attack:begin', { actor, ability, targets, pursuit: isPursuit, combo: chain.actions, chain });

      for (let i = 0; i < ability.hits.length; i++) {
        const live = targets.filter(t => t.alive);
        if (!live.length) break;
        const hit = ability.hits[i];
        const results = live.map(t => this.applyHit(actor, t, ability, hit, chain, isPursuit));
        await this.emit('hit', {
          actor, ability, hit, hitIndex: i, hitCount: ability.hits.length,
          results, pursuit: isPursuit, combo: chain.actions, chain,
        });
        for (const r of results) if (r.killed) await this.handleDeath(r.target, actor);
      }
      await this.emit('attack:end', { actor, ability, pursuit: isPursuit, combo: chain.actions, chain });
    }

    /** Applique UN coup sur UNE cible (calculs seulement, pas d'animation). */
    applyHit(actor, target, ability, hit, chain, isPursuit) {
      const res = {
        target, damage: 0, crit: false, heal: 0, lifesteal: 0, chakra: 0, state: null,
        buffs: [], cleansed: 0, killed: false, hpBefore: target.hp, hpAfter: target.hp,
      };
      const ctx = { actor, target, ability, hit, pursuit: isPursuit, combo: chain.actions };

      if (hit.power > 0 && target.side !== actor.side) {
        let dmg = R().damageScale * actor.stat('atk') * hit.power * (R().defenseConstant / (R().defenseConstant + target.stat('def')));
        res.crit = this.rng.chance(actor.stat('crit'));
        if (res.crit) dmg *= R().critMultiplier;
        dmg *= 1 + (this.rng.next() * 2 - 1) * R().damageVariance;
        dmg *= R().comboScaling[Math.min(chain.actions - 1, R().comboScaling.length - 1)];
        dmg *= actor.dealtMod(ctx) * target.takenMod(ctx);
        res.damage = Math.max(1, Math.round(dmg));
        target.hp = Math.max(0, target.hp - res.damage);
        chain.damage += res.damage;
        chain.hits++;
        chain.last = target;
        chain.affected.add(target);
        if (hit.lifesteal > 0) {
          const before = actor.hp;
          actor.hp = Math.min(actor.maxHp, actor.hp + Math.round(res.damage * hit.lifesteal));
          res.lifesteal = actor.hp - before;
        }
        target.gainChakra(R().chakraOnHurt);
        res.killed = target.hp <= 0;
        if (res.killed) { target.alive = false; target.state = null; }
      }

      if (hit.heal > 0 && target.side === actor.side && target.alive) {
        const before = target.hp;
        target.hp = Math.min(target.maxHp, target.hp + Math.round(actor.stat('atk') * hit.heal));
        res.heal = target.hp - before;
      }
      if (hit.chakra && target.alive) res.chakra = target.gainChakra(hit.chakra); // signé : négatif = drain
      if (hit.cleanse && target.alive) res.cleansed = target.cleanse();

      if (target.alive && hit.state && target.side !== actor.side && this.rng.chance(hit.stateChance)) {
        target.state = hit.state;
        res.state = hit.state;
        chain.affected.add(target);
      }

      for (const b of hit.buffs) {
        const to = b.to === 'self' ? actor : target;
        if (!to.alive || !this.rng.chance(b.chance)) continue;
        to.addBuff(b.id, b.duration, actor);
        res.buffs.push({ unit: to, id: b.id });
      }

      res.hpAfter = target.hp;
      return res;
    }

    async handleDeath(unit, killer) {
      await this.emit('death', { unit, killer });
      if (killer && killer.alive) await this.trigger('onKill', killer, { victim: unit });
    }

    // ---------- helpers utilisables par les passifs / effets ----------
    async dot(unit, amount, buff) {
      if (!unit.alive) return;
      amount = Math.min(amount, unit.hp);
      unit.hp -= amount;
      const killed = unit.hp <= 0;
      if (killed) { unit.alive = false; unit.state = null; }
      await this.emit('dot', { unit, amount, buff, killed, hpAfter: unit.hp });
      if (killed) await this.emit('death', { unit, killer: buff.source });
    }

    async heal(unit, amount, source) {
      if (!unit.alive) return 0;
      const before = unit.hp;
      unit.hp = Math.min(unit.maxHp, unit.hp + Math.round(amount));
      const gained = unit.hp - before;
      if (gained > 0) await this.emit('heal', { unit, amount: gained, source, hpAfter: unit.hp });
      return gained;
    }

    async addChakra(unit, amount) {
      if (!unit.alive) return 0;
      const g = unit.gainChakra(amount);
      if (g) await this.emit('chakra', { unit, amount: g });
      return g;
    }

    /** Appelle le crochet `name` des passifs de `unit`. */
    async trigger(name, unit, payload = {}) {
      if (!unit.alive && name !== 'onBattleStart') return;
      for (const p of unit.passives) {
        if (p[name]) await p[name](this, unit, payload);
      }
    }
  }

  SC.Battle = Battle;
})(typeof window !== 'undefined' ? window : globalThis);
