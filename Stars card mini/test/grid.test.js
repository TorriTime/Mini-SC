const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const hex = require("../game/hexGrid");
const { reachableCells, shortestPath } = require("../game/movement");

const cell = (col, row) => hex.offsetToAxial(col, row);
const keys = cells => cells.map(c => hex.key(c.q, c.r));

describe("hexGrid", () => {
  it("convertit offset <-> axial sans perte", () => {
    for (let col = 0; col < 9; col++) {
      for (let row = 0; row < 11; row++) {
        const { q, r } = hex.offsetToAxial(col, row);
        assert.deepEqual(hex.axialToOffset(q, r), { col, row });
      }
    }
  });

  it("mesure les distances et trace des lignes continues", () => {
    assert.equal(hex.cubeDistance(cell(2, 8), cell(2, 4)), 4);
    assert.equal(hex.cubeDistance(cell(2, 5), cell(2, 5)), 0);
    const line = hex.hexLine(cell(0, 0), cell(6, 4));
    assert.deepEqual(line[0], cell(0, 0));
    assert.deepEqual(line[line.length - 1], cell(6, 4));
    for (let i = 1; i < line.length; i++) assert.equal(hex.cubeDistance(line[i - 1], line[i]), 1);
  });

  for (const players of [2, 4]) {
    it(`plateau ${players} joueurs : zones de deploiement disjointes et dans le plateau`, () => {
      const board = hex.createBoard(players);
      assert.equal(board.seats.length, players);
      const seen = new Set();
      for (const side of board.seats) {
        const zone = board.deployZone(side);
        assert.ok(zone.length > 0);
        for (const c of zone) {
          assert.ok(board.inBounds(c.q, c.r));
          assert.ok(!seen.has(hex.key(c.q, c.r)), "case revendiquee par deux camps");
          seen.add(hex.key(c.q, c.r));
        }
        const start = board.championStart(side);
        assert.ok(keys(zone).includes(hex.key(start.q, start.r)), "le Champion demarre dans sa zone");
      }
    });

    it(`plateau ${players} joueurs : une mine de camp par joueur, mines dans le plateau`, () => {
      const board = hex.createBoard(players);
      const sites = board.mineSites();
      assert.equal(sites.length, 9);
      assert.deepEqual(sites.filter(s => s.home).map(s => s.home).sort(), board.seats.slice().sort());
      for (const s of sites) assert.ok(board.inBounds(s.q, s.r));
    });
  }

  it("ne renvoie que des voisins dans le plateau", () => {
    const board = hex.createBoard(2);
    assert.equal(board.neighbors(cell(4, 5).q, cell(4, 5).r).length, 6);
    assert.equal(board.neighbors(cell(0, 0).q, cell(0, 0).r).length, 2);
  });
});

describe("movement", () => {
  const board = hex.createBoard(2);
  const none = new Set();

  it("atteint exactement les cases a portee, case de depart exclue", () => {
    const from = cell(4, 5);
    assert.equal(reachableCells(board, from, 1, none).length, 6);
    assert.equal(reachableCells(board, from, 2, none).length, 18);
    assert.deepEqual(reachableCells(board, from, 0, none), []);
    assert.ok(!keys(reachableCells(board, from, 2, none)).includes(hex.key(from.q, from.r)));
  });

  it("ne traverse jamais une case occupee", () => {
    const from = cell(0, 0);
    const blocked = new Set(keys(board.neighbors(from.q, from.r)));
    assert.deepEqual(reachableCells(board, from, 5, blocked), []);
    assert.equal(shortestPath(board, from, cell(4, 5), 20, blocked), null);
  });

  it("renvoie un chemin continu du depart a l'arrivee, ou null hors de portee", () => {
    const from = cell(2, 8), to = cell(2, 5);
    const path = shortestPath(board, from, to, 3, none);
    assert.equal(path.length, 4);
    assert.deepEqual(path[0], from);
    assert.deepEqual(path[3], to);
    for (let i = 1; i < path.length; i++) assert.equal(hex.cubeDistance(path[i - 1], path[i]), 1);
    assert.equal(shortestPath(board, from, to, 2, none), null);
    assert.deepEqual(shortestPath(board, from, from, 0, none), [from]);
  });

  it("contourne les obstacles", () => {
    const from = cell(2, 8), to = cell(2, 6);
    const wall = new Set([hex.key(cell(2, 7).q, cell(2, 7).r)]);
    assert.equal(shortestPath(board, from, to, 2, wall), null);
    assert.equal(shortestPath(board, from, to, 3, wall).length, 4);
  });
});
