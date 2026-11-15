// Action "attaquer" + resolution complete d'une attaque normale (degats de
// zone, morts, riposte), reutilisee par la Charge (voir actions/ability.js).

const hex = require("../hexGrid");
const { addLog } = require("../log");
const { cardsById } = require("../catalog");
const { isAlive, revealFromInvisibility } = require("../units");
const { ownsUnit, damageMultiplier } = require("../battlefield");
const { inRange, resolveAttack, canRetaliate, scaleDamage, dealDamage } = require("../combat");
const { markAggressionNearMines } = require("../mines");
const { assertTurn, resolveDeaths } = require("../turns");

/** Unites ennemies avec Provocation a portee de `attackerLike` (qui peut
 * etre une vraie unite, ou {ownerId, range, q, r} pour verifier une
 * position pas-encore-occupee, ex : Charge apres deplacement calcule mais
 * avant mutation). */
function tauntersInRange(state, attackerLike) {
  return Object.values(state.units).filter(u =>
    isAlive(u) && u.ownerId !== attackerLike.ownerId &&
    u.abilities && u.abilities.includes("provocation") &&
    hex.cubeDistance(attackerLike, u) <= attackerLike.range
  );
}

/** Provocation : si une unite ennemie provocatrice est a portee, la cible
 * choisie doit en faire partie. Ne force jamais l'attaque elle-meme --
 * uniquement invoque quand le joueur a deja decide d'attaquer. */
function assertValidAttackTarget(state, attackerLike, target) {
  const taunters = tauntersInRange(state, attackerLike);
  if (taunters.length > 0 && !taunters.some(u => u.id === target.id)) {
    throw new Error("Une unite avec Provocation est a portee : elle doit etre ciblee en priorite.");
  }
}

/** Degats de zone (ex : Dynamiteur) : les unites a `splash.radius` de la
 * cible principale (alliees ou ennemies, hors attaquant et cible) recoivent
 * `splash.percent` des degats REELLEMENT infliges a la cible. Ne se propage
 * jamais en chaine (une seule passe, calculee une fois). */
function applySplash(state, attacker, target, damageDealt) {
  const card = cardsById[attacker.sourceId];
  const splash = card && card.splash;
  if (!splash) return [];

  const baseSplash = damageDealt * splash.percent;
  const nearby = Object.values(state.units).filter(u =>
    u.id !== target.id && u.id !== attacker.id && isAlive(u) &&
    hex.cubeDistance(u, target) <= splash.radius
  );

  const hits = [];
  for (const u of nearby) {
    const damage = scaleDamage(baseSplash, damageMultiplier(state, u));
    dealDamage(u, damage);
    hits.push({ unit: u, damage });
  }
  if (hits.length > 0) {
    addLog(state, `${attacker.name} inflige des degats de zone (${scaleDamage(baseSplash)}) a ${hits.length} unite(s).`);
  }
  return hits;
}

/**
 * Attaque normale deja validee de `attacker` sur `target` : degats, degats
 * de zone, morts, puis riposte eventuelle. `verb` sert au log ("attaque",
 * "charge"). Retourne le rapport { damage, targetHealth, targetKO, splash,
 * retaliation }.
 */
function performAttack(state, attacker, target, verb) {
  const result = resolveAttack(attacker, target, damageMultiplier(state, target));
  attacker.hasAttacked = true;
  revealFromInvisibility(attacker); // attaquer revele toujours l'attaquant
  addLog(state, `${attacker.name} ${verb} ${target.name} (${result.damage} degats).`);
  markAggressionNearMines(state, attacker, target);

  const splashHits = applySplash(state, attacker, target, result.damage);
  resolveDeaths(state, [target, ...splashHits.map(h => h.unit)]);

  // Riposte : une seule, jamais en chaine. La cible ne riposte que si
  // l'option est active, qu'elle a survecu et qu'elle peut reellement
  // atteindre l'attaquant avec SA propre portee.
  let retaliation = null;
  if (state.options.retaliate && isAlive(target) && isAlive(attacker) && canRetaliate(target, attacker)) {
    retaliation = resolveAttack(target, attacker, damageMultiplier(state, attacker));
    addLog(state, `${target.name} riposte contre ${attacker.name} (${retaliation.damage} degats).`);
    markAggressionNearMines(state, target, attacker);
    resolveDeaths(state, [attacker]);
  }

  return {
    ...result,
    splash: splashHits.map(h => ({ unitId: h.unit.id, damage: h.damage })),
    retaliation
  };
}

function attackUnit(state, playerId, attackerId, targetId) {
  assertTurn(state, playerId);
  const attacker = state.units[attackerId];
  const target = state.units[targetId];
  if (!ownsUnit(state, playerId, attacker)) throw new Error("Attaquant invalide.");
  if (!isAlive(target)) throw new Error("Cible invalide.");
  if (target.ownerId === playerId) throw new Error("Impossible d'attaquer sa propre unite.");
  if (attacker.hasAttacked) throw new Error("Cette unite a deja attaque.");
  if (!inRange(attacker, target)) throw new Error("Cible hors de portee.");
  assertValidAttackTarget(state, attacker, target);

  return performAttack(state, attacker, target, "attaque");
}

module.exports = { attackUnit, performAttack, assertValidAttackTarget };
