const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { gs, cell, startedGame, spawn, give, setMana, fullRound } = require("./helpers");

// Mine neutre du plateau 2 joueurs situee en (colonne 1, ligne 7).
const MINE = cell(1, 7);
const mineAt = (view, c) => view.mines.find(m => m.q === c.q && m.r === c.r);

/** p1 possede une tour sur la mine neutre MINE, et a de nouveau la main. */
function gameWithTower(options) {
  const { state } = startedGame({ options });
  const worker = spawn(state, "p1", "worker", 1, 8);
  gs.moveUnit(state, "p1", worker.id, MINE.q, MINE.r);
  fullRound(state);
  const tower = Object.values(state.units).find(u => u.isTower);
  return { state, tower };
}

describe("mines", () => {
  it("chaque mine controlee rapporte un quart par tour, 4 quarts = +1 de limite de mana", () => {
    const { state } = startedGame();
    fullRound(state);
    assert.equal(state.players.p1.quarters, 1);
    state.players.p1.quarters = 3;
    fullRound(state);
    assert.deepEqual([state.players.p1.quarters, state.players.p1.maxMana], [0, 2]);
    assert.equal(state.players.p1.mana, 3);
  });

  it("la limite de mana ne depasse jamais 10", () => {
    const { state } = startedGame();
    setMana(state, "p1", 0, 10);
    state.players.p1.quarters = 3;
    fullRound(state);
    assert.deepEqual([state.players.p1.quarters, state.players.p1.maxMana], [3, 10]);
  });

  it("un Ouvrier reste un tour complet au centre d'une mine pour y construire une tour", () => {
    const { state } = startedGame();
    const worker = spawn(state, "p1", "worker", 1, 8);
    gs.moveUnit(state, "p1", worker.id, MINE.q, MINE.r);
    assert.ok(worker.settlingMineId);
    assert.equal(mineAt(gs.serializeForPlayer(state, "p1"), MINE).ownerId, null);

    fullRound(state);
    assert.equal(state.units[worker.id], undefined);
    const tower = Object.values(state.units).find(u => u.isTower);
    assert.deepEqual({ q: tower.q, r: tower.r, ownerId: tower.ownerId }, { ...MINE, ownerId: "p1" });
    assert.equal(mineAt(gs.serializeForPlayer(state, "p2"), MINE).ownerId, "p1");
    assert.equal(state.players.p1.quarters, 2, "mine de camp + nouvelle mine");
  });

  it("un Ouvrier qui repart avant la fin du tour complet ne construit rien", () => {
    const { state } = startedGame();
    const worker = spawn(state, "p1", "worker", 1, 8);
    gs.moveUnit(state, "p1", worker.id, MINE.q, MINE.r);
    worker.hasMoved = false;
    gs.moveUnit(state, "p1", worker.id, cell(1, 8).q, cell(1, 8).r);
    assert.equal(worker.settlingMineId, undefined);
    fullRound(state);
    assert.ok(state.units[worker.id]);
  });

  it("detruire la tour stoppe aussitot la domination", () => {
    const { state, tower } = gameWithTower();
    gs.endTurn(state, "p1");
    const berserker = spawn(state, "p2", "berserker", 1, 6);
    gs.attackUnit(state, "p2", berserker.id, tower.id);
    assert.equal(tower.health, 0);
    assert.equal(state.units[tower.id], undefined);
    assert.equal(mineAt(gs.serializeForPlayer(state, "p1"), MINE).ownerId, null);
  });

  it("deploiement avance a cote d'une tour, au prix du prochain quart de la mine", () => {
    const { state, tower } = gameWithTower();
    const advanced = gs.serializeForPlayer(state, "p1").deployCells.filter(c => c.advanced);
    assert.equal(advanced.length, 6);
    assert.equal(gs.serializeForPlayer(state, "p2").deployCells.filter(c => c.advanced).length, 0);

    setMana(state, "p1", 5);
    const quartersBefore = state.players.p1.quarters;
    gs.playCard(state, "p1", give(state, "p1", "soldier"), advanced[0].q, advanced[0].r);
    assert.equal(tower.skipQuarter, true);
    fullRound(state);
    assert.equal(state.players.p1.quarters, quartersBefore + 1, "seule la mine de camp a rapporte");
    assert.equal(tower.skipQuarter, false);
  });
});

describe("zones sures", () => {
  it("garantit 2 de deplacement pres d'une mine controlee, jusqu'a une agression ennemie", () => {
    const { state } = startedGame();
    const tank = spawn(state, "p1", "tank", 4, 8); // a cote de la mine de camp de p1
    const farTank = spawn(state, "p1", "tank", 4, 5);
    const view = () => gs.serializeForPlayer(state, "p1");
    assert.equal(view().units[tank.id].effectiveMovement, 2);
    assert.equal(view().units[farTank.id].effectiveMovement, 1);

    gs.endTurn(state, "p1");
    const archer = spawn(state, "p2", "archer", 4, 6);
    gs.attackUnit(state, "p2", archer.id, tank.id);
    assert.equal(view().mines.find(m => m.home && m.ownerId === "p1").safe, false);
    assert.equal(view().units[tank.id].effectiveMovement, 1);

    gs.endTurn(state, "p2"); // plus d'ennemi dans la zone au debut du tour de p1
    assert.equal(view().mines.find(m => m.home && m.ownerId === "p1").safe, true);
    assert.equal(view().units[tank.id].effectiveMovement, 2);
  });

  it("une unite immobilisee reste immobile meme en zone sure", () => {
    const { state, tower } = gameWithTower();
    assert.equal(gs.serializeForPlayer(state, "p1").units[tower.id].effectiveMovement, 0);
    assert.deepEqual(gs.getReachableForUnit(state, tower.id), []);
  });
});
