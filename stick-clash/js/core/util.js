/* ============================================================
 * Noyau : espace de noms SC, registres, aléatoire, easing.
 * Aucun accès au DOM ici : ce fichier est aussi chargé par les
 * tests Node (tests/run.js).
 * ============================================================ */
(function (root) {
  'use strict';
  const SC = (root.SC = root.SC || {});

  /** Registre générique : tout contenu (personnage, état, effet, VFX…) y est déclaré par id. */
  class Registry {
    constructor(kind) { this.kind = kind; this.map = new Map(); }
    register(def) {
      if (!def || !def.id) throw new Error(`[${this.kind}] définition sans id`);
      this.map.set(def.id, def);
      return def;
    }
    has(id) { return this.map.has(id); }
    get(id) {
      const d = this.map.get(id);
      if (!d) throw new Error(`[${this.kind}] id inconnu : "${id}"`);
      return d;
    }
    list() { return [...this.map.values()]; }
  }
  SC.Registry = Registry;

  // Registres « données » (moteur)
  SC.characters = new Registry('personnage');
  SC.states = new Registry('état');
  SC.buffs = new Registry('effet');
  SC.elements = new Registry('élément');

  /** PRNG déterministe (mulberry32) : un même seed rejoue le même combat. */
  SC.Random = class Random {
    constructor(seed) { this.s = (seed >>> 0) || 1; }
    next() {
      let t = (this.s += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    chance(p) { return p >= 1 || (p > 0 && this.next() < p); }
    int(n) { return Math.floor(this.next() * n); }
    pick(arr) { return arr[this.int(arr.length)]; }
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = this.int(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    }
  };

  SC.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  SC.lerp = (a, b, t) => a + (b - a) * t;

  SC.ease = {
    linear: t => t,
    inQuad: t => t * t,
    outQuad: t => 1 - (1 - t) * (1 - t),
    inOutQuad: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    inCubic: t => t * t * t,
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    outBounce: t => {
      const n = 7.5625, d = 2.75;
      if (t < 1 / d) return n * t * t;
      if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
      if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
      return n * (t -= 2.625 / d) * t + 0.984375;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
