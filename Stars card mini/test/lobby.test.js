const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { gs, cell, startedGame, championOf, BASIC_DECK } = require("./helpers");

describe("salon d'attente", () => {
  it("cree une partie en attente avec un code de 5 caracteres", () => {
    const state = gs.createGame("p1", "Alice");
    assert.match(state.code, /^[A-HJ-NP-Z2-9]{5}$/);
    assert.equal(state.status, "waiting");
    assert.equal(state.maxPlayers, 2);
    assert.deepEqual(state.options, gs.DEFAULT_OPTIONS);
    assert.equal(state.players.p1.name, "Alice");
  });

  it("ignore les options inconnues", () => {
    const state = gs.createGame("p1", "", { maxPlayers: 3, options: { handLimit: 6, turnTimerSeconds: 5, sandbox: 1 } });
    assert.equal(state.maxPlayers, 2);
    assert.equal(state.players.p1.name, "Joueur");
    assert.deepEqual(state.options, { ...gs.DEFAULT_OPTIONS, sandbox: true });
  });

  it("normalise les textes libres envoyes par le client", () => {
    const state = gs.createGame("p1", "  " + "A".repeat(40));
    assert.equal(state.players.p1.name, "A".repeat(16));
    gs.joinGame(state, "p2", { toString: () => "<script>" });
    assert.equal(state.players.p2.name, "Joueur");
    gs.setPlayerLoadout(state, "p1", { championId: "kael", deckCardIds: BASIC_DECK, deckName: ["<b>"] });
    assert.equal(state.players.p1.deckName, "Deck");
  });

  it("refuse un joueur de trop ou une partie deja lancee", () => {
    const state = gs.createGame("p1", "Alice");
    gs.joinGame(state, "p2", "Bob");
    assert.throws(() => gs.joinGame(state, "p3", "Eve"), /pleine/);
    const { state: started } = startedGame();
    assert.throws(() => gs.joinGame(started, "p3", "Eve"), /deja commence/);
  });

  it("valide le champion et le deck", () => {
    const state = gs.createGame("p1", "Alice");
    const loadout = extra => ({ championId: "kael", deckCardIds: BASIC_DECK, deckName: "Mon deck", ...extra });
    assert.throws(() => gs.setPlayerLoadout(state, "inconnu", loadout()), /Joueur inconnu/);
    assert.throws(() => gs.setPlayerLoadout(state, "p1", loadout({ championId: "nope" })), /Champion invalide/);
    assert.throws(() => gs.setPlayerLoadout(state, "p1", loadout({ championId: "constructor" })), /Champion invalide/);
    assert.throws(
      () => gs.setPlayerLoadout(state, "p1", loadout({ deckCardIds: [...BASIC_DECK.slice(0, 8), "nope", "constructor"] })),
      /2 carte\(s\) manquante\(s\)/
    );
    assert.equal(state.players.p1.ready, false);

    gs.setPlayerLoadout(state, "p1", loadout({ deckCardIds: [...BASIC_DECK, "strike", "nope"], deckName: "  " + "x".repeat(60) }));
    assert.equal(state.players.p1.ready, true);
    assert.equal(state.players.p1.deckCardIds.length, 11);
    assert.equal(state.players.p1.deckName, "x".repeat(40));
  });

  it("ne demarre que lorsque tous les joueurs sont prets", () => {
    const state = gs.createGame("p1", "Alice");
    gs.setPlayerLoadout(state, "p1", { championId: "kael", deckCardIds: BASIC_DECK });
    gs.startGame(state);
    assert.equal(state.status, "waiting");
    gs.joinGame(state, "p2", "Bob");
    assert.equal(gs.allPlayersReady(state), false);
    gs.setPlayerLoadout(state, "p2", { championId: "vex", deckCardIds: BASIC_DECK });
    assert.equal(gs.allPlayersReady(state), true);
    gs.startGame(state);
    assert.equal(state.status, "playing");
  });

  it("met en place la partie au lancement", () => {
    const { state } = startedGame({ champions: ["kael", "kira"] });
    assert.equal(gs.activePlayerId(state), "p1");
    assert.deepEqual([state.players.p1.side, state.players.p2.side], ["bottom", "top"]);
    for (const pid of ["p1", "p2"]) {
      const p = state.players[pid];
      assert.equal(p.hand.length, 5);
      assert.equal(p.deck.length, 5);
      assert.deepEqual([p.mana, p.maxMana, p.quarters], [1, 1, 0]);
    }
    assert.deepEqual({ q: championOf(state, "p1").q, r: championOf(state, "p1").r }, cell(4, 10));
    assert.deepEqual({ q: championOf(state, "p2").q, r: championOf(state, "p2").r }, cell(4, 0));
    assert.equal(championOf(state, "p2").name, "Kira, l'Oeil de Faucon");
    assert.equal(state.mines.length, 9);
    assert.deepEqual(state.mines.filter(m => m.homeOwnerId).map(m => m.homeOwnerId), ["p1", "p2"]);
  });

  it("libere la place d'un joueur qui quitte le salon", () => {
    const state = gs.createGame("p1", "Alice");
    gs.joinGame(state, "p2", "Bob");
    gs.removePlayer(state, "p2");
    assert.deepEqual(state.order, ["p1"]);
    assert.equal(state.players.p2, undefined);
    gs.joinGame(state, "p3", "Eve");
    assert.deepEqual(state.order, ["p1", "p3"]);
  });
});
