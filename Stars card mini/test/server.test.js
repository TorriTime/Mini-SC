const { describe, it, mock } = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("../server/server");
const { GameRooms } = require("../server/gameRooms");
const { registerSocketHandlers } = require("../server/socketHandlers");
const { cell, BASIC_DECK } = require("./helpers");

/** Faux reseau socket.io en memoire : memes interfaces que celles utilisees
 * par le serveur (io.on/io.to, socket.on/socket.emit). */
function fakeNetwork() {
  const sockets = new Map();
  let onConnection;
  const io = {
    on(event, handler) { if (event === "connection") onConnection = handler; },
    to(id) {
      return { emit: (event, payload) => { if (sockets.has(id)) sockets.get(id).received.push({ event, payload }); } };
    }
  };
  const rooms = new GameRooms(io);
  registerSocketHandlers(io, rooms);

  function connect(id) {
    const handlers = {};
    const socket = {
      id,
      received: [],
      on(event, handler) { handlers[event] = handler; },
      emit(event, payload) { this.received.push({ event, payload }); },
      /** Simule un evenement envoye par le client. */
      send(event, payload, ack) { handlers[event](payload, ack); },
      all(event) { return this.received.filter(m => m.event === event).map(m => m.payload); },
      last(event) { return this.all(event).pop(); },
      disconnect() { sockets.delete(id); handlers.disconnect(); }
    };
    sockets.set(id, socket);
    onConnection(socket);
    return socket;
  }
  return { rooms, connect };
}

/** Deux joueurs dans une partie lancee (alice a la main). */
function startedMatch(options) {
  const net = fakeNetwork();
  const alice = net.connect("alice"), bob = net.connect("bob");
  alice.send("createGame", { name: "Alice", maxPlayers: 2, options });
  const { code } = alice.last("gameCreated");
  bob.send("joinGame", { code: ` ${code.toLowerCase()} `, name: "Bob" });
  for (const s of [alice, bob]) s.send("setLoadout", { championId: "kael", deckCardIds: BASIC_DECK, deckName: "Test" });
  return { ...net, alice, bob, code, state: net.rooms.gameOf("alice") };
}

describe("serveur HTTP", () => {
  it("sert le client et les donnees du jeu, sans cache", async t => {
    const server = createServer();
    await new Promise(resolve => server.listen(0, resolve));
    t.after(() => server.close());
    const base = `http://localhost:${server.address().port}`;

    const cards = await fetch(`${base}/api/cards`);
    assert.equal(cards.headers.get("cache-control"), "no-store");
    assert.deepEqual(await cards.json(), require("../data/cards"));
    for (const name of ["spells", "champions", "abilities", "patchnotes"]) {
      assert.equal((await fetch(`${base}/api/${name}`)).status, 200);
    }
    assert.equal((await fetch(`${base}/api/inconnu`)).status, 404);
    assert.match(await (await fetch(base)).text(), /<title>Stars Cards - Mini<\/title>/);
  });
});

describe("protocole temps reel", () => {
  it("cree, rejoint et lance une partie ; chacun recoit sa propre vue", () => {
    const { alice, bob, code } = startedMatch();
    assert.deepEqual(bob.last("gameJoined"), { code });
    for (const [socket, id] of [[alice, "alice"], [bob, "bob"]]) {
      const view = socket.last("state");
      assert.equal(view.status, "playing");
      assert.equal(view.you, id);
      assert.equal(view.players[id].hand.length, 5);
    }
    assert.equal(alice.last("state").players.bob.hand, undefined);
  });

  it("renvoie les erreurs au seul joueur concerne", () => {
    const { alice, bob } = startedMatch();
    const statesBefore = alice.all("state").length;
    bob.send("endTurn");
    assert.equal(bob.last("errorMessage"), "Ce n'est pas votre tour.");
    assert.deepEqual(alice.all("errorMessage"), []);
    assert.equal(alice.all("state").length, statesBefore);

    const stranger = fakeNetwork().connect("stranger");
    stranger.send("joinGame", { code: "ZZZZZ" });
    assert.equal(stranger.last("errorMessage"), "Partie introuvable.");
    stranger.send("endTurn");
    assert.equal(stranger.last("errorMessage"), "Aucune partie active.");
  });

  it("supporte les donnees absentes ou invalides sans planter", () => {
    const { alice } = startedMatch();
    for (const payload of [undefined, null, "texte", 42]) {
      for (const event of ["createGame", "joinGame", "setLoadout", "playCard", "moveUnit", "attackUnit", "useAbility", "castSpell", "requestReachable", "rematch"]) {
        assert.doesNotThrow(() => alice.send(event, payload));
      }
    }
  });

  it("diffuse l'etat et l'animation apres une action", () => {
    const { alice, bob, state } = startedMatch();
    const champion = state.units[state.players.alice.championUnitId];
    alice.send("requestReachable", { unitId: champion.id }, res => {
      assert.equal(res.ok, true);
      assert.ok(res.cells.length > 0);
    });
    const to = cell(4, 8);
    alice.send("moveUnit", { unitId: champion.id, q: to.q, r: to.r });
    for (const socket of [alice, bob]) {
      const moved = socket.last("unitMoved");
      assert.equal(moved.unitId, champion.id);
      assert.deepEqual(moved.path[moved.path.length - 1], to);
      assert.deepEqual(socket.last("state").units[champion.id].q, to.q);
    }
  });

  it("ne revele pas le trajet d'une unite invisible", () => {
    const { alice, bob, state } = startedMatch();
    const champion = state.units[state.players.alice.championUnitId];
    champion.buffs.push({ type: "invisible", turnsLeft: 2 });
    alice.send("moveUnit", { unitId: champion.id, q: cell(4, 8).q, r: cell(4, 8).r });
    assert.equal(alice.all("unitMoved").length, 1);
    assert.equal(bob.all("unitMoved").length, 0);
    assert.equal(bob.last("state").units[champion.id], undefined);
  });

  it("une deconnexion en cours de partie donne la victoire a l'adversaire", () => {
    const { alice, bob } = startedMatch();
    bob.disconnect();
    assert.equal(alice.last("state").status, "finished");
    assert.equal(alice.last("state").winnerId, "alice");
  });

  it("une deconnexion dans le salon libere la place", () => {
    const net = fakeNetwork();
    const alice = net.connect("alice"), bob = net.connect("bob");
    alice.send("createGame", { name: "Alice" });
    bob.send("joinGame", { code: alice.last("gameCreated").code, name: "Bob" });
    bob.disconnect();
    assert.deepEqual(alice.last("state").order, ["alice"]);
    assert.equal(net.rooms.gameOf("bob"), undefined);
  });

  it("rejouer recree un salon avec le meme code, les memes joueurs et options", () => {
    const { alice, bob, code } = startedMatch({ handLimit: 7 });
    alice.send("forfeit");
    bob.send("rematch");
    for (const socket of [alice, bob]) {
      const view = socket.last("state");
      assert.equal(view.status, "waiting");
      assert.equal(view.code, code);
      assert.deepEqual(view.order, ["alice", "bob"]);
      assert.equal(view.options.handLimit, 7);
      assert.equal(view.players.bob.ready, false);
    }
  });

  it("le chronometre de tour termine le tour a la place du joueur", () => {
    mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.UTC(2026, 0, 1) });
    try {
      const { alice, bob } = startedMatch({ turnTimerSeconds: 20 });
      assert.equal(alice.last("state").turnRemainingSeconds, 20);
      mock.timers.tick(19000);
      assert.equal(alice.last("state").activePlayerId, "alice");
      mock.timers.tick(1000);
      assert.equal(alice.last("state").activePlayerId, "bob");
      mock.timers.tick(10000);
      bob.send("endTurn");
      mock.timers.tick(19000);
      assert.equal(bob.last("state").activePlayerId, "alice", "le chrono repart a chaque nouveau tour");
      mock.timers.tick(1000);
      assert.equal(bob.last("state").activePlayerId, "bob");
      alice.disconnect();
      assert.equal(bob.last("state").status, "finished");
    } finally {
      mock.timers.reset();
    }
  });
});
