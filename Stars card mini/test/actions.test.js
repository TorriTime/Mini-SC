const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { gs, hex, cell, startedGame, spawn, give, setMana, championOf, teleport, fullRound } = require("./helpers");

const pos = unit => ({ q: unit.q, r: unit.r });

describe("jouer une carte d'unite", () => {
  it("invoque l'unite dans la zone de deploiement et depense le mana", () => {
    const { state } = startedGame();
    setMana(state, "p1", 3);
    const card = give(state, "p1", "soldier");
    const target = cell(0, 10);
    const unit = gs.playCard(state, "p1", card, target.q, target.r);
    assert.equal(state.units[unit.id], unit);
    assert.deepEqual(pos(unit), target);
    assert.equal(state.players.p1.mana, 1);
    assert.ok(!state.players.p1.hand.some(c => c.instanceId === card));
  });

  it("refuse sans rien modifier une action invalide", () => {
    const { state } = startedGame();
    setMana(state, "p1", 10, 3);
    const soldier = give(state, "p1", "soldier");
    const tank = give(state, "p1", "tank");
    const spell = give(state, "p1", "strike");
    const before = JSON.stringify(state.players.p1);
    const free = cell(0, 10), middle = cell(4, 5), champion = cell(4, 10);

    assert.throws(() => gs.playCard(state, "p2", soldier, free.q, free.r), /pas votre tour/);
    assert.throws(() => gs.playCard(state, "p1", "inconnue", free.q, free.r), /introuvable/);
    assert.throws(() => gs.playCard(state, "p1", spell, free.q, free.r), /est un sort/);
    assert.throws(() => gs.playCard(state, "p1", tank, free.q, free.r), /limite de mana est de 3/);
    assert.throws(() => gs.playCard(state, "p1", soldier, middle.q, middle.r), /deploiement invalide/);
    assert.throws(() => gs.playCard(state, "p1", soldier, champion.q, champion.r), /deja occupee/);
    setMana(state, "p1", 1, 3);
    assert.throws(() => gs.playCard(state, "p1", soldier, free.q, free.r), /Mana insuffisant/);
    setMana(state, "p1", 10, 3);

    assert.equal(JSON.stringify(state.players.p1), before);
    assert.equal(Object.keys(state.units).length, 2);
  });
});

describe("deplacer une unite", () => {
  it("deplace l'unite le long d'un chemin valide, une seule fois par tour", () => {
    const { state } = startedGame();
    const soldier = spawn(state, "p1", "soldier", 2, 5);
    const to = cell(2, 3);
    const { path, triggeredTraps } = gs.moveUnit(state, "p1", soldier.id, to.q, to.r);
    assert.equal(path.length, 3);
    assert.deepEqual(triggeredTraps, []);
    assert.deepEqual(pos(soldier), to);
    assert.throws(() => gs.moveUnit(state, "p1", soldier.id, cell(2, 4).q, cell(2, 4).r), /deja bouge/);
  });

  it("refuse les cases occupees, hors de portee, ou les unites d'un autre joueur", () => {
    const { state } = startedGame();
    const soldier = spawn(state, "p1", "soldier", 2, 5);
    const enemy = spawn(state, "p2", "soldier", 2, 4);
    assert.throws(() => gs.moveUnit(state, "p1", soldier.id, enemy.q, enemy.r), /Case occupee/);
    assert.throws(() => gs.moveUnit(state, "p1", soldier.id, cell(2, 1).q, cell(2, 1).r), /hors de portee/);
    assert.throws(() => gs.moveUnit(state, "p1", enemy.id, cell(2, 3).q, cell(2, 3).r), /Unite invalide/);
    assert.deepEqual(pos(soldier), cell(2, 5));
  });
});

describe("attaquer", () => {
  it("inflige les degats puis subit la riposte", () => {
    const { state } = startedGame();
    const attacker = spawn(state, "p1", "soldier", 2, 5);
    const target = spawn(state, "p2", "soldier", 2, 4);
    const result = gs.attackUnit(state, "p1", attacker.id, target.id);
    assert.equal(result.damage, 20);
    assert.equal(result.retaliation.damage, 20);
    assert.deepEqual([attacker.health, target.health], [35, 35]);
    assert.throws(() => gs.attackUnit(state, "p1", attacker.id, target.id), /deja attaque/);
  });

  it("pas de riposte si l'option est desactivee ou si l'attaquant est hors de portee de la cible", () => {
    const off = startedGame({ options: { retaliate: false } }).state;
    const a = spawn(off, "p1", "soldier", 2, 5), b = spawn(off, "p2", "soldier", 2, 4);
    assert.equal(gs.attackUnit(off, "p1", a.id, b.id).retaliation, null);
    assert.equal(a.health, 55);

    const { state } = startedGame();
    const archer = spawn(state, "p1", "archer", 2, 6), soldier = spawn(state, "p2", "soldier", 2, 4);
    assert.equal(gs.attackUnit(state, "p1", archer.id, soldier.id).retaliation, null);
    assert.deepEqual([archer.health, soldier.health], [40, 30]);
  });

  it("retire du plateau une unite detruite", () => {
    const { state } = startedGame();
    const berserker = spawn(state, "p1", "berserker", 2, 5);
    const militia = spawn(state, "p2", "militia", 2, 4);
    const result = gs.attackUnit(state, "p1", berserker.id, militia.id);
    assert.equal(result.targetKO, true);
    assert.equal(result.retaliation, null);
    assert.equal(state.units[militia.id], undefined);
  });

  it("refuse les cibles invalides", () => {
    const { state } = startedGame();
    const attacker = spawn(state, "p1", "soldier", 2, 5);
    const ally = spawn(state, "p1", "soldier", 2, 6);
    const far = spawn(state, "p2", "soldier", 2, 2);
    assert.throws(() => gs.attackUnit(state, "p1", attacker.id, far.id), /hors de portee/);
    assert.throws(() => gs.attackUnit(state, "p1", attacker.id, ally.id), /propre unite/);
    assert.throws(() => gs.attackUnit(state, "p1", attacker.id, "nope"), /Cible invalide/);
    assert.throws(() => gs.attackUnit(state, "p1", far.id, attacker.id), /Attaquant invalide/);
  });

  it("Provocation : oblige a cibler l'unite provocatrice a portee", () => {
    const { state } = startedGame();
    const attacker = spawn(state, "p1", "soldier", 2, 5);
    const guardian = spawn(state, "p2", "guardian", 2, 4);
    const other = spawn(state, "p2", "soldier", 2, 6);
    assert.throws(() => gs.attackUnit(state, "p1", attacker.id, other.id), /Provocation/);
    assert.equal(attacker.hasAttacked, false);
    gs.attackUnit(state, "p1", attacker.id, guardian.id);
    assert.equal(guardian.health, 70);
  });

  it("degats de zone : touche allies et ennemis autour de la cible", () => {
    const { state } = startedGame();
    const dynamiter = spawn(state, "p1", "dynamiter", 2, 7);
    const ownSoldier = spawn(state, "p1", "soldier", 2, 6);
    const target = spawn(state, "p2", "soldier", 2, 5);
    const militia = spawn(state, "p2", "militia", 2, 4);
    const result = gs.attackUnit(state, "p1", dynamiter.id, target.id);
    assert.equal(target.health, 25);
    assert.deepEqual(result.splash.map(h => h.damage), [15, 15]);
    assert.deepEqual([ownSoldier.health, militia.health, dynamiter.health], [40, 5, 45]);
  });

  it("aura du Noyau celeste : reduit les degats subis par ses allies", () => {
    const { state } = startedGame();
    const attacker = spawn(state, "p1", "soldier", 2, 5);
    const target = spawn(state, "p2", "soldier", 2, 4);
    spawn(state, "p2", "celestial_core", 5, 5);
    assert.equal(gs.attackUnit(state, "p1", attacker.id, target.id).damage, 17);
    assert.equal(attacker.health, 35, "l'aura ne protege pas les ennemis");
  });
});

describe("competences", () => {
  it("Soin : soigne un allie a portee, 2 fois par tour au plus", () => {
    const { state } = startedGame();
    setMana(state, "p1", 10);
    const healer = spawn(state, "p1", "healer", 2, 6);
    const wounded = spawn(state, "p1", "soldier", 2, 5);
    const enemy = spawn(state, "p2", "soldier", 2, 4);
    wounded.health = 10;
    assert.throws(() => gs.useAbility(state, "p1", healer.id, "heal", enemy.id), /alliee requise/);
    assert.deepEqual(gs.useAbility(state, "p1", healer.id, "heal", wounded.id), { type: "heal", amount: 20 });
    gs.useAbility(state, "p1", healer.id, "heal", wounded.id);
    assert.equal(wounded.health, 50);
    assert.equal(state.players.p1.mana, 6);
    assert.throws(() => gs.useAbility(state, "p1", healer.id, "heal", wounded.id), /utilisations maximum/);
    fullRound(state);
    gs.useAbility(state, "p1", healer.id, "heal", wounded.id);
    assert.equal(wounded.health, 55, "jamais au-dessus des PV max");
  });

  it("Mur de boucliers : reduit les degats pendant 2 tours du proprietaire", () => {
    const { state } = startedGame();
    setMana(state, "p1", 5);
    const guardian = spawn(state, "p1", "guardian", 2, 5);
    const enemy = spawn(state, "p2", "soldier", 2, 4);
    gs.useAbility(state, "p1", guardian.id, "shield_wall", guardian.id);
    gs.endTurn(state, "p1");
    assert.equal(gs.attackUnit(state, "p2", enemy.id, guardian.id).damage, 10);
    gs.endTurn(state, "p2");
    fullRound(state);
    assert.deepEqual(guardian.buffs, []);
  });

  it("refuse une competence passive, inconnue ou trop chere", () => {
    const { state } = startedGame();
    const guardian = spawn(state, "p1", "guardian", 2, 5);
    assert.throws(() => gs.useAbility(state, "p1", guardian.id, "provocation", guardian.id), /passive/);
    assert.throws(() => gs.useAbility(state, "p1", guardian.id, "heal", guardian.id), /inconnue pour cette unite/);
    assert.throws(() => gs.useAbility(state, "p1", guardian.id, "shield_wall", guardian.id), /Mana insuffisant/);
  });

  it("Charge : se deplace jusqu'a la cible puis l'attaque", () => {
    const { state } = startedGame();
    setMana(state, "p1", 5);
    const knight = spawn(state, "p1", "knight", 2, 8);
    const target = spawn(state, "p2", "soldier", 2, 4);
    const result = gs.useAbility(state, "p1", knight.id, "charge", target.id);
    assert.equal(result.moved, true);
    assert.equal(result.path.length, 4);
    assert.equal(result.unitId, knight.id);
    assert.deepEqual(pos(knight), cell(2, 5));
    assert.deepEqual([target.health, knight.health], [37, 50]);
    assert.deepEqual([knight.hasMoved, knight.hasAttacked], [true, true]);
    assert.equal(state.players.p1.mana, 3);
  });

  it("Charge : impossible si une unite bloque la ligne directe, sans rien depenser", () => {
    const { state } = startedGame();
    setMana(state, "p1", 5);
    const knight = spawn(state, "p1", "knight", 2, 8);
    const target = spawn(state, "p2", "soldier", 2, 4);
    spawn(state, "p1", "soldier", 2, 6);
    assert.throws(() => gs.useAbility(state, "p1", knight.id, "charge", target.id), /bloque le chemin/);
    assert.deepEqual(pos(knight), cell(2, 8));
    assert.equal(state.players.p1.mana, 5);
    assert.equal(knight.hasMoved, false);
  });

  it("Perforation : touche tous les ennemis alignes, epargne les allies", () => {
    const { state } = startedGame({ champions: ["vex", "kael"] });
    setMana(state, "p1", 5);
    const vex = teleport(championOf(state, "p1"), 2, 8);
    const ally = spawn(state, "p1", "soldier", 2, 7);
    const first = spawn(state, "p2", "soldier", 2, 6);
    const second = spawn(state, "p2", "soldier", 2, 5);
    const target = spawn(state, "p2", "militia", 2, 4);
    const result = gs.useAbility(state, "p1", vex.id, "piercing_shot_vex", target.id);
    assert.equal(result.hits.length, 3);
    assert.deepEqual([ally.health, first.health, second.health], [55, 30, 30]);
    assert.equal(state.units[target.id], undefined);
    assert.equal(state.players.p1.mana, 2);
  });

  it("Camouflage : l'unite disparait pour l'adversaire jusqu'a ce qu'elle attaque", () => {
    const { state } = startedGame();
    setMana(state, "p1", 5);
    const scout = spawn(state, "p1", "scout", 2, 5);
    const enemy = spawn(state, "p2", "tank", 2, 4);
    gs.useAbility(state, "p1", scout.id, "camouflage", scout.id);
    assert.equal(gs.isUnitVisibleTo(scout, "p2"), false);
    assert.equal(gs.serializeForPlayer(state, "p2").units[scout.id], undefined);
    assert.equal(gs.serializeForPlayer(state, "p1").units[scout.id].invisible, true);
    gs.attackUnit(state, "p1", scout.id, enemy.id);
    assert.equal(gs.isUnitVisibleTo(scout, "p2"), true);
    assert.ok(gs.serializeForPlayer(state, "p2").units[scout.id]);
  });
});

describe("sorts", () => {
  it("Frappe : degats directs, la carte part a la defausse", () => {
    const { state } = startedGame();
    setMana(state, "p1", 5);
    const strike = give(state, "p1", "strike");
    const enemy = spawn(state, "p2", "soldier", 2, 4);
    assert.deepEqual(gs.castSpell(state, "p1", strike, enemy.id), { type: "damage", amount: 45, targetKO: false });
    assert.equal(enemy.health, 10);
    assert.equal(state.players.p1.mana, 2);
    assert.deepEqual(state.players.p1.graveyard, [{ instanceId: strike, cardId: "strike" }]);
    assert.ok(!state.players.p1.hand.some(c => c.instanceId === strike));
  });

  it("une carte ne peut pas couter plus que la limite de mana", () => {
    const { state } = startedGame();
    setMana(state, "p1", 10, 2);
    const strike = give(state, "p1", "strike");
    const enemy = spawn(state, "p2", "soldier", 2, 4);
    assert.throws(() => gs.castSpell(state, "p1", strike, enemy.id), /limite de mana est de 2/);
    assert.equal(enemy.health, 55);
  });

  it("valide la cible avant de consommer mana et carte", () => {
    const { state } = startedGame();
    setMana(state, "p1", 5);
    const strike = give(state, "p1", "strike");
    const heal = give(state, "p1", "heal");
    const soldier = give(state, "p1", "soldier");
    const ally = spawn(state, "p1", "soldier", 2, 5);
    const handSize = state.players.p1.hand.length;
    assert.throws(() => gs.castSpell(state, "p1", strike, ally.id), /ennemie requise/);
    assert.throws(() => gs.castSpell(state, "p1", strike, null), /Cible invalide/);
    assert.throws(() => gs.castSpell(state, "p1", heal, championOf(state, "p2").id), /alliee requise/);
    assert.throws(() => gs.castSpell(state, "p1", soldier, ally.id), /n'est pas un sort/);
    assert.throws(() => gs.castSpell(state, "p1", "inconnue", ally.id), /introuvable/);
    assert.equal(state.players.p1.mana, 5);
    assert.equal(state.players.p1.hand.length, handSize);
  });

  it("Soin et Ravitaillement", () => {
    const { state } = startedGame();
    setMana(state, "p1", 5);
    const ally = spawn(state, "p1", "soldier", 2, 5);
    ally.health = 40;
    assert.deepEqual(gs.castSpell(state, "p1", give(state, "p1", "heal"), ally.id), { type: "heal", amount: 15 });
    const handSize = state.players.p1.hand.length;
    gs.castSpell(state, "p1", give(state, "p1", "draw"), null);
    assert.equal(state.players.p1.hand.length, handSize + 2);
  });

  it("Jet d'eau : la boue retire 1 de deplacement (minimum 1)", () => {
    const { state } = startedGame();
    setMana(state, "p1", 10);
    const soldier = spawn(state, "p1", "soldier", 2, 5);
    const archer = spawn(state, "p1", "archer", 6, 5);
    gs.castSpell(state, "p1", give(state, "p1", "water_jet"), null, cell(2, 5));
    gs.castSpell(state, "p1", give(state, "p1", "water_jet"), null, cell(6, 5));
    assert.throws(() => gs.castSpell(state, "p1", give(state, "p1", "water_jet"), null, { q: 50, r: 50 }), /Case cible invalide/);
    const view = gs.serializeForPlayer(state, "p1");
    assert.deepEqual(view.mudCells, [hex.key(soldier.q, soldier.r), hex.key(archer.q, archer.r)]);
    assert.equal(view.units[soldier.id].effectiveMovement, 1);
    assert.equal(view.units[archer.id].effectiveMovement, 1);
    assert.equal(gs.getReachableForUnit(state, soldier.id).length, 6);
  });

  it("Piege : visible de son seul proprietaire, declenche par un ennemi qui le traverse", () => {
    const { state } = startedGame();
    setMana(state, "p1", 5);
    const trapCell = cell(2, 4);
    gs.castSpell(state, "p1", give(state, "p1", "trap"), null, trapCell);
    assert.deepEqual(gs.serializeForPlayer(state, "p1").traps.map(t => ({ q: t.q, r: t.r })), [trapCell]);
    assert.deepEqual(gs.serializeForPlayer(state, "p2").traps, []);

    const own = spawn(state, "p1", "soldier", 2, 5);
    assert.deepEqual(gs.moveUnit(state, "p1", own.id, cell(2, 3).q, cell(2, 3).r).triggeredTraps, []);
    teleport(own, 6, 6);

    gs.endTurn(state, "p1");
    const enemy = spawn(state, "p2", "soldier", 2, 5);
    const { triggeredTraps } = gs.moveUnit(state, "p2", enemy.id, cell(2, 3).q, cell(2, 3).r);
    assert.equal(triggeredTraps.length, 1);
    assert.deepEqual(state.traps, {});
  });

  it("Piege : interdit sur une mine", () => {
    const { state } = startedGame();
    setMana(state, "p1", 5);
    const trap = give(state, "p1", "trap");
    const mine = state.mines.find(m => !m.homeOwnerId);
    assert.throws(() => gs.castSpell(state, "p1", trap, null, { q: mine.q, r: mine.r }), /piege sur une mine/);
    assert.equal(state.players.p1.mana, 5);
    assert.ok(state.players.p1.hand.some(c => c.instanceId === trap));
  });
});
