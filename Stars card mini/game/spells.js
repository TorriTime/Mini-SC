// Effets des sorts (voir data/spells.js). Chaque type d'effet declare :
//   validate(state, ctx) -- optionnel : leve une erreur si la cible est
//                           refusee, AVANT toute depense de mana/carte
//   apply(state, ctx)    -- applique l'effet et retourne un petit rapport
// ctx = { playerId, effect, target (unite ou null), cell ({q,r} ou null) }

const hex = require("./hexGrid");
const { scaleDamage, dealDamage, healUnit } = require("./combat");
const { damageMultiplier } = require("./battlefield");
const { isMineCell } = require("./mines");
const { placeTrap } = require("./traps");
const { drawCard, resolveDeaths } = require("./turns");

const SPELL_EFFECTS = {
  // Degats directs : ignorent la defense de la cible (contrairement aux
  // attaques et competences), mais pas les auras de reduction.
  damage: {
    apply(state, { effect, target }) {
      const amount = scaleDamage(effect.amount, damageMultiplier(state, target));
      dealDamage(target, amount);
      const report = { type: "damage", amount, targetKO: target.health <= 0 };
      resolveDeaths(state, [target]);
      return report;
    }
  },

  heal: {
    apply(state, { effect, target }) {
      return { type: "heal", amount: healUnit(target, effect.amount) };
    }
  },

  draw: {
    apply(state, { effect, playerId }) {
      for (let i = 0; i < effect.amount; i++) drawCard(state, playerId);
      return { type: "draw", amount: effect.amount };
    }
  },

  mud: {
    // Pas de cumul : un Set ne stocke chaque case qu'une fois, cibler une
    // case deja boueuse est donc sans risque (juste sans effet supplementaire).
    apply(state, { cell }) {
      state.mudCells.add(hex.key(cell.q, cell.r));
      return { type: "mud", q: cell.q, r: cell.r };
    }
  },

  trap: {
    validate(state, { cell }) {
      if (cell && isMineCell(state, cell.q, cell.r)) {
        throw new Error("Impossible de poser un piege sur une mine.");
      }
    },
    // Le log partage mentionne bien qu'un sort a ete lance, mais JAMAIS la
    // position du piege -- seul son declenchement la revelera.
    apply(state, { playerId, cell }) {
      placeTrap(state, playerId, cell);
      return { type: "trap", q: cell.q, r: cell.r };
    }
  }
};

function spellEffectHandler(effectType) {
  const handler = SPELL_EFFECTS[effectType];
  if (!handler) throw new Error(`Type d'effet de sort inconnu: ${effectType}`);
  return handler;
}

module.exports = { spellEffectHandler };
