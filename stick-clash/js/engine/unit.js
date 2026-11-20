/* Un combattant en cours de partie : PV, chakra, recharges, effets, état de contrôle. */
(function (root) {
  'use strict';
  const SC = root.SC;

  class Unit {
    constructor(def, side, slot, battle) {
      this.def = def;
      this.id = side + slot;
      this.name = def.name;
      this.side = side;
      this.slot = slot;
      this.battle = battle;

      this.base = Object.assign({}, def.stats);
      this.maxHp = def.stats.hp;
      this.hp = this.maxHp;
      this.chakra = SC.rules.startChakra;
      this.maxChakra = SC.rules.maxChakra;

      this.alive = true;
      this.state = null;          // état de contrôle courant (HIGH, LOW, PUSH, DOWN) ou null
      this.buffs = [];            // { id, duration, source }
      this.cooldowns = {};

      this.normal = def.normal;
      this.special = def.special;
      this.pursuits = def.pursuits;
      this.passives = def.passives;
      if (this.special && this.special.initialCooldown) this.cooldowns[this.special.id] = this.special.initialCooldown;

      // Valeurs « affichées » (le rendu les fait tourner en douceur, le moteur les ignore)
      this.shownHp = this.hp;
      this.ghostHp = this.hp;
    }

    get team() { return this.battle.teams[this.side]; }
    get foes() { return this.battle.teams[this.side === 'A' ? 'B' : 'A']; }
    get actions() { return [this.normal, this.special, SC.defendAbility].filter(Boolean); }

    /** Statistique finale = base × passifs × effets. */
    stat(name) {
      let v = this.base[name];
      for (const p of this.passives) {
        if (p.stats) { const m = p.stats(this); if (m && m[name]) v *= m[name]; }
      }
      for (const b of this.buffs) {
        const d = SC.buffs.get(b.id);
        if (d.stats && d.stats[name]) v *= d.stats[name];
      }
      return v;
    }

    dealtMod(ctx) {
      let m = 1;
      for (const p of this.passives) if (p.damageDealt) m *= p.damageDealt(this, ctx) ?? 1;
      for (const b of this.buffs) {
        const d = SC.buffs.get(b.id);
        if (d.damageDealt) m *= typeof d.damageDealt === 'function' ? d.damageDealt(this, ctx, b) : d.damageDealt;
      }
      return m;
    }

    takenMod(ctx) {
      let m = SC.rules.slotDamageTaken[this.slot] ?? 1;
      for (const p of this.passives) if (p.damageTaken) m *= p.damageTaken(this, ctx) ?? 1;
      for (const b of this.buffs) {
        const d = SC.buffs.get(b.id);
        if (d.damageTaken) m *= typeof d.damageTaken === 'function' ? d.damageTaken(this, ctx, b) : d.damageTaken;
      }
      return m;
    }

    hasBuff(id) { return this.buffs.some(b => b.id === id); }

    addBuff(id, duration, source) {
      const ex = this.buffs.find(b => b.id === id);
      if (ex) { ex.duration = Math.max(ex.duration, duration); ex.source = source; }
      else this.buffs.push({ id, duration, source });
    }

    cleanse() {
      const before = this.buffs.length;
      this.buffs = this.buffs.filter(b => !SC.buffs.get(b.id).debuff);
      return before - this.buffs.length;
    }

    gainChakra(n) {
      const before = this.chakra;
      this.chakra = SC.clamp(this.chakra + n, 0, this.maxChakra);
      return this.chakra - before;
    }

    /** Peut-on utiliser cette capacité maintenant ? */
    canUse(ab) {
      if (!this.alive) return { ok: false, reason: 'KO' };
      if (ab.type === 'special') {
        const cd = this.cooldowns[ab.id] || 0;
        if (cd > 0) return { ok: false, reason: `Recharge : ${cd} tour${cd > 1 ? 's' : ''}` };
        if (this.chakra < ab.cost) return { ok: false, reason: `Chakra insuffisant (${ab.cost})` };
      }
      return { ok: true };
    }

    spend(ab) {
      if (ab.type !== 'special') return;
      this.chakra -= ab.cost;
      this.cooldowns[ab.id] = ab.cooldown;
    }

    /** Début de tour : regain de chakra et décompte des recharges. */
    startTurn() {
      this.gainChakra(SC.rules.chakraPerTurn);
      for (const k of Object.keys(this.cooldowns)) if (this.cooldowns[k] > 0) this.cooldowns[k]--;
    }

    /** Décompte des durées d'effets ; renvoie les effets expirés. */
    tickBuffs() {
      const expired = [];
      for (const b of this.buffs) b.duration--;
      this.buffs = this.buffs.filter(b => { if (b.duration <= 0) { expired.push(b); return false; } return true; });
      return expired;
    }
  }

  SC.Unit = Unit;
})(typeof window !== 'undefined' ? window : globalThis);
