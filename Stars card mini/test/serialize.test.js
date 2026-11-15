const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { gs, hex, startedGame } = require("./helpers");

describe("vue envoyee a un joueur", () => {
  it("ne contient que la main du joueur concerne", () => {
    const { state } = startedGame();
    const view = gs.serializeForPlayer(state, "p2");
    assert.equal(view.you, "p2");
    assert.equal(view.players.p2.hand.length, 5);
    assert.equal(view.players.p1.hand, undefined);
    assert.equal(view.players.p1.handCount, 5);
    assert.equal(JSON.stringify(view).includes(state.players.p1.hand[0].instanceId), false);
  });

  it("decrit le plateau, le tour et les cases de deploiement", () => {
    const { state } = startedGame({ options: { turnTimerSeconds: 40 } });
    const view = gs.serializeForPlayer(state, "p1");
    assert.equal(view.status, "playing");
    assert.equal(view.activePlayerId, "p1");
    assert.ok(view.turnRemainingSeconds <= 40 && view.turnRemainingSeconds >= 39);
    assert.deepEqual({ cols: view.board.cols, rows: view.board.rows, seats: view.board.seats },
      { cols: 9, rows: 11, seats: ["bottom", "top"] });
    assert.deepEqual(Object.keys(view.board.deployZones), ["bottom", "top"]);
    assert.deepEqual(view.board.deployZones.bottom, state.boardConfig.deployZone("bottom"));
    assert.equal(view.deployCells.length, 18);
    assert.ok(view.deployCells.every(c => !c.advanced));
    assert.equal(view.players.p1.manaCap, 1);
    assert.equal(view.mines.length, 9);
    assert.equal(view.mines[0].zone.length, 7);
  });

  it("n'a pas de chronometre sans option, ni de joueur actif hors partie", () => {
    const waiting = gs.createGame("p1", "Alice");
    const view = gs.serializeForPlayer(waiting, "p1");
    assert.equal(view.activePlayerId, null);
    assert.equal(view.turnRemainingSeconds, null);
    assert.deepEqual(view.deployCells, []);
    assert.equal(gs.serializeForPlayer(startedGame().state, "p1").turnRemainingSeconds, null);
  });

  it("limite le journal aux 15 derniers messages", () => {
    const { state } = startedGame();
    for (let i = 0; i < 30; i++) gs.endTurn(state, gs.activePlayerId(state));
    assert.equal(gs.serializeForPlayer(state, "p1").log.length, 15);
    assert.ok(state.log.length <= 50);
  });

  it("est entierement serialisable en JSON", () => {
    const { state } = startedGame({ players: 4 });
    const view = gs.serializeForPlayer(state, "p3");
    assert.deepEqual(JSON.parse(JSON.stringify(view)).mudCells, []);
    assert.equal(hex.key(1, 2), "1,2");
  });
});
