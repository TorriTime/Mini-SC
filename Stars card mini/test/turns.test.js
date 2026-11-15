const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { gs, startedGame, spawn, give, setMana, championOf, teleport, fullRound } = require("./helpers");

describe("tours de jeu", () => {
  it("fait tourner la main et compte les tours", () => {
    const { state } = startedGame();
    assert.throws(() => gs.endTurn(state, "p2"), /pas votre tour/);
    gs.endTurn(state, "p1");
    assert.equal(gs.activePlayerId(state), "p2");
    assert.equal(state.turnNumber, 1);
    gs.endTurn(state, "p2");
    assert.equal(gs.activePlayerId(state), "p1");
    assert.equal(state.turnNumber, 2);
  });

  it("pioche une carte et rend le mana au debut du tour", () => {
    const { state } = startedGame();
    setMana(state, "p1", 5, 4);
    fullRound(state);
    assert.equal(state.players.p1.hand.length, 6);
    assert.equal(state.players.p1.mana, 6, "plafonne a limite + moitie de la limite");
  });

  it("respecte la limite de cartes en main", () => {
    const { state } = startedGame({ options: { handLimit: 5 } });
    fullRound(state);
    assert.equal(state.players.p1.hand.length, 5);
    assert.equal(state.players.p1.deck.length, 5);
  });

  it("ne pioche rien quand la pioche est vide, sauf option de remelange", () => {
    const empty = startedGame().state;
    empty.players.p2.deck = [];
    empty.players.p2.graveyard = [{ instanceId: "g1", cardId: "strike" }];
    gs.endTurn(empty, "p1");
    assert.equal(empty.players.p2.hand.length, 5);

    const reshuffle = startedGame({ options: { reshuffleDiscard: true } }).state;
    reshuffle.players.p2.deck = [];
    reshuffle.players.p2.graveyard = [{ instanceId: "g1", cardId: "strike" }];
    gs.endTurn(reshuffle, "p1");
    assert.equal(reshuffle.players.p2.hand.length, 6);
    assert.deepEqual(reshuffle.players.p2.graveyard, []);
  });

  it("reinitialise deplacement et attaque a la fin du tour", () => {
    const { state } = startedGame();
    const unit = spawn(state, "p1", "soldier", 2, 5);
    unit.hasMoved = true;
    unit.hasAttacked = true;
    gs.endTurn(state, "p1");
    assert.deepEqual([unit.hasMoved, unit.hasAttacked], [false, false]);
  });
});

describe("passifs de champion", () => {
  it("regen : Kael recupere des PV au debut de son tour", () => {
    const { state } = startedGame();
    const kael = championOf(state, "p1");
    kael.health = 100;
    fullRound(state);
    assert.equal(kael.health, 109);
    kael.health = kael.maxHealth - 2;
    fullRound(state);
    assert.equal(kael.health, kael.maxHealth);
  });

  it("frenzy : Vex frappe plus fort a 50% de PV ou moins", () => {
    const { state } = startedGame({ champions: ["vex", "kael"] });
    const vex = teleport(championOf(state, "p1"), 2, 6);
    const tank = spawn(state, "p2", "tank", 2, 5);
    vex.health = 65;
    assert.equal(gs.attackUnit(state, "p1", vex.id, tank.id).damage, 55);
  });

  it("alternate_movement : Kira ne se deplace qu'un tour sur deux", () => {
    const { state } = startedGame({ champions: ["kira", "kael"] });
    const kira = championOf(state, "p1");
    assert.equal(kira.movement, 2);
    fullRound(state);
    assert.equal(kira.movement, 0);
    assert.deepEqual(gs.getReachableForUnit(state, kira.id), []);
    fullRound(state);
    assert.equal(kira.movement, 2);
  });
});

describe("eliminations et fin de partie", () => {
  it("a 2 joueurs, la mort d'un Champion termine la partie", () => {
    const { state } = startedGame();
    const berserker = spawn(state, "p1", "berserker", 2, 5);
    teleport(championOf(state, "p2"), 2, 4).health = 10;
    gs.attackUnit(state, "p1", berserker.id, championOf(state, "p2").id);
    assert.equal(state.status, "finished");
    assert.equal(state.winnerId, "p1");
    assert.equal(state.players.p2.eliminated, true);
    assert.throws(() => gs.endTurn(state, "p1"), /pas en cours/);
    assert.throws(() => gs.forfeit(state, "p1"), /Aucune partie en cours/);
  });

  it("a 4 joueurs, l'abandon du joueur actif donne un vrai debut de tour au suivant", () => {
    const { state } = startedGame({ players: 4 });
    gs.forfeit(state, "p1");
    assert.equal(state.status, "playing");
    assert.deepEqual(state.turnOrder, ["p2", "p3", "p4"]);
    assert.equal(gs.activePlayerId(state), "p2");
    assert.equal(state.players.p2.hand.length, 6);
    assert.equal(state.players.p2.quarters, 1);
    assert.throws(() => gs.forfeit(state, "p1"), /plus dans cette partie/);
  });

  it("a 4 joueurs, l'elimination d'un autre joueur ne perturbe pas le tour en cours", () => {
    const { state } = startedGame({ players: 4 });
    gs.endTurn(state, "p1");
    gs.endTurn(state, "p2");
    const startedAt = state.turnStartedAt;
    gs.removePlayer(state, "p1");
    assert.equal(state.players.p1.connected, false);
    assert.equal(gs.activePlayerId(state), "p3");
    assert.equal(state.turnStartedAt, startedAt);
    gs.forfeit(state, "p4");
    gs.forfeit(state, "p2");
    assert.equal(state.status, "finished");
    assert.equal(state.winnerId, "p3");
  });

  it("une mine de camp n'appartient plus a un joueur elimine", () => {
    const { state } = startedGame({ players: 4 });
    gs.forfeit(state, "p3");
    const home = gs.serializeForPlayer(state, "p1").mines.filter(m => m.home);
    assert.deepEqual(home.map(m => m.ownerId), ["p1", "p2", null, "p4"]);
  });
});

describe("mode bac a sable", () => {
  it("un Champion mort reapparait aussitot, mobile et sans buff", () => {
    const { state } = startedGame({ options: { sandbox: true }, champions: ["kael", "kira"] });
    const kira = championOf(state, "p2");
    Object.assign(kira, { health: 10, movement: 0, canMoveThisTurn: false, buffs: [{ type: "attack", amount: 5, turnsLeft: 2 }] });
    const strike = give(state, "p1", "strike");
    gs.castSpell(state, "p1", strike, kira.id);
    assert.equal(state.status, "playing");
    assert.equal(kira.health, kira.maxHealth);
    assert.deepEqual([kira.movement, kira.canMoveThisTurn, kira.buffs], [2, true, []]);
    assert.ok(state.players.p1.hand.some(c => c.instanceId === strike), "la carte reste en main");
    assert.equal(state.players.p1.mana, 1, "le mana n'est pas depense");
  });

  it("une carte d'unite reste jouable a l'infini", () => {
    const { state } = startedGame({ options: { sandbox: true } });
    const juggernaut = give(state, "p1", "juggernaut");
    const zone = state.boardConfig.deployZone("bottom");
    gs.playCard(state, "p1", juggernaut, zone[0].q, zone[0].r);
    gs.playCard(state, "p1", juggernaut, zone[1].q, zone[1].r);
    assert.equal(Object.values(state.units).filter(u => u.sourceId === "juggernaut").length, 2);
  });
});
