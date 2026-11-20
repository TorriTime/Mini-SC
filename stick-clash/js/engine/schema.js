/* ============================================================
 * Définition & validation des personnages.
 *
 * SC.defineCharacter({
 *   id, name, title, role, element,
 *   look:   { color, accent, parts:[...] }          // rendu stickman
 *   stats:  { hp, atk, def, spd, crit },
 *   normal: Ability,                                // attaque normale
 *   special:Ability,                                // technique (chakra + recharge)
 *   pursuits:[Ability+triggers],                    // poursuites
 *   passives:[{ id, name, desc, ...crochets }],
 * })
 *
 * Ability = {
 *   id, name, desc,
 *   cost, cooldown, initialCooldown,                // spécial uniquement
 *   target: 'enemy'|'enemies'|'ally'|'allies'|'self',
 *   move:   'melee'|'ranged'|'none',                // le lanceur s'approche-t-il ?
 *   approach: 'run'|'blink',
 *   anim:   nom d'animation (render/anims.js),
 *   vfx:    { cast, travel, impact }                // noms d'effets (render/vfxlib.js)
 *   element,                                        // couleur des VFX (défaut : celui du perso)
 *   triggers: ['HIGH', ...]                         // poursuites : états déclencheurs
 *   hits: [{
 *     power,                  // multiplicateur d'ATK
 *     state, stateChance,     // état infligé
 *     buffs:[{id,duration,chance,to:'target'|'self'}],
 *     heal,                   // soin = ATK × heal (cibles alliées)
 *     lifesteal,              // % des dégâts rendus au lanceur
 *     chakra,                 // chakra donné/retiré à la cible
 *     cleanse,                // retire les effets négatifs
 *     anim,                   // animation propre à ce coup
 *   }]
 * }
 *
 * Crochets de passifs (tous facultatifs) :
 *   stats(unit)               -> { atk: 1.2 } | null     multiplicateurs de stats
 *   damageDealt(unit, ctx)    -> multiplicateur
 *   damageTaken(unit, ctx)    -> multiplicateur
 *   onBattleStart / onTurnStart / onKill : async (battle, unit, payload)
 * ============================================================ */
(function (root) {
  'use strict';
  const SC = root.SC;
  const TARGETS = ['enemy', 'enemies', 'ally', 'allies', 'self'];

  function normalizeHit(h, where) {
    const hit = Object.assign(
      { power: 0, state: null, stateChance: 1, buffs: [], heal: 0, chakra: 0, lifesteal: 0, cleanse: false },
      h
    );
    hit.buffs = hit.buffs.map(b => Object.assign({ duration: 2, chance: 1, to: 'target' }, b));
    if (hit.state && !SC.states.has(hit.state)) throw new Error(`${where} : état inconnu "${hit.state}"`);
    hit.buffs.forEach(b => {
      if (!SC.buffs.has(b.id)) throw new Error(`${where} : effet inconnu "${b.id}"`);
    });
    return hit;
  }

  function normalizeAbility(a, type, element) {
    if (!a || !a.id) throw new Error(`Capacité (${type}) sans id`);
    const target = a.target || (type === 'defend' ? 'self' : 'enemy');
    if (!TARGETS.includes(target)) throw new Error(`${a.id} : cible invalide "${target}"`);
    const ab = Object.assign(
      {
        type, name: a.id, desc: '', cost: 0, cooldown: 0, initialCooldown: 0,
        target, move: target === 'enemy' ? 'melee' : 'none', approach: 'run',
        anim: 'punch', element, triggers: [],
      },
      a
    );
    ab.vfx = Object.assign({}, a.vfx);
    ab.hits = (a.hits && a.hits.length ? a.hits : [{ power: 1 }]).map((h, i) => normalizeHit(h, `${ab.id}#${i}`));
    if (type !== 'special') { ab.cost = 0; ab.cooldown = 0; ab.initialCooldown = 0; }
    if (type === 'pursuit') {
      ab.target = 'enemy';
      if (!ab.triggers.length) throw new Error(`${ab.id} : une poursuite doit avoir des "triggers"`);
      ab.triggers.forEach(s => { if (!SC.states.has(s)) throw new Error(`${ab.id} : état inconnu "${s}"`); });
    }
    return ab;
  }

  SC.defineCharacter = function (raw) {
    if (!raw.id) throw new Error('Personnage sans id');
    const element = raw.element || 'neutral';
    if (!SC.elements.has(element)) throw new Error(`${raw.id} : élément inconnu "${element}"`);
    const s = raw.stats || {};
    ['hp', 'atk', 'def', 'spd'].forEach(k => {
      if (typeof s[k] !== 'number') throw new Error(`${raw.id} : stat "${k}" manquante`);
    });
    const def = {
      title: '', role: '', ...raw, element,
      stats: Object.assign({ crit: 0.1 }, s),
      look: Object.assign({ color: '#ffffff', accent: '#ffd36b', parts: [] }, raw.look),
      normal: normalizeAbility(raw.normal, 'normal', element),
      special: raw.special ? normalizeAbility(raw.special, 'special', element) : null,
      pursuits: (raw.pursuits || []).map(p => normalizeAbility(p, 'pursuit', element)),
      passives: (raw.passives || []).map(p => Object.assign({ name: p.id, desc: '' }, p)),
    };
    SC.characters.register(def);
    return def;
  };

  // Action universelle « Concentration » : passer son tour en récupérant du chakra.
  SC.defendAbility = normalizeAbility(
    {
      id: 'defend', name: 'Concentration', target: 'self', move: 'none', anim: 'guard',
      desc: 'Récupère 25 chakra et réduit les dégâts subis jusqu\'au prochain tour.',
      vfx: { cast: 'focus' },
      hits: [{ chakra: 25, buffs: [{ id: 'guard', duration: 1, to: 'self' }] }],
    },
    'defend', 'neutral'
  );
})(typeof window !== 'undefined' ? window : globalThis);
