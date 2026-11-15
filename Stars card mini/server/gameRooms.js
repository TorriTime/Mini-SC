// Parties en cours sur ce serveur (en memoire) : registre code -> partie,
// diffusion de l'etat a chaque joueur et chronometre de tour.
// L'identifiant d'un joueur est l'id de son socket.
//
// Un joueur est "rattache" a une seule partie a la fois (codeByPlayer). Il
// s'en detache en se deconnectant ou en creant/rejoignant une autre partie.
// Une partie que plus aucun joueur ne suit est retiree de la memoire, quel
// que soit son statut (salon vide, partie abandonnee, partie terminee) : il
// n'y a donc jamais plus de parties en memoire que de joueurs connectes.
// Tant qu'un joueur y reste rattache, une partie terminee est conservee
// pour permettre "Rejouer".

const gs = require("../game/gameState");

class GameRooms {
  /** `io` : serveur socket.io (seul `io.to(playerId).emit(...)` est utilise). */
  constructor(io) {
    this.io = io;
    this.games = new Map();        // code -> etat de partie
    this.codeByPlayer = new Map(); // playerId -> code de sa partie
    this.turnTimers = new Map();   // code -> Timeout du chronometre de tour
  }

  create(playerId, name, settings) {
    const state = gs.createGame(playerId, name, settings);
    this.leave(playerId); // quitte sa partie precedente, s'il en avait une
    this.games.set(state.code, state);
    this.codeByPlayer.set(playerId, state.code);
    return state;
  }

  join(playerId, rawCode, name) {
    const code = String(rawCode || "").toUpperCase().trim();
    const state = this.games.get(code);
    if (!state) throw new Error("Partie introuvable.");
    // Deja assis dans ce salon (ex : retour au menu puis meme code) : rien a faire.
    const alreadySeated = this.isFollowing(playerId, code) && state.status === "waiting";
    if (!alreadySeated) {
      // joinGame d'abord : s'il refuse (partie pleine, deja lancee), le joueur
      // garde sa partie precedente.
      gs.joinGame(state, playerId, name);
      this.leave(playerId);
      this.codeByPlayer.set(playerId, code);
    }
    return state;
  }

  /** Vrai si le joueur est rattache a la partie `code`. */
  isFollowing(playerId, code) {
    return this.codeByPlayer.get(playerId) === code;
  }

  /** Joueurs de la partie qui y sont encore rattaches (connectes et pas partis ailleurs). */
  followers(code) {
    const state = this.games.get(code);
    if (!state) return [];
    return Object.keys(state.players).filter(id => this.isFollowing(id, code));
  }

  /** Retire la partie de la memoire (et son chronometre). */
  discard(code) {
    this.clearTurnTimer(code);
    this.games.delete(code);
  }

  /** Partie du joueur, ou undefined s'il n'en a pas. */
  gameOf(playerId) {
    return this.games.get(this.codeByPlayer.get(playerId));
  }

  /** Partie du joueur ; leve une erreur (destinee au joueur) s'il n'en a pas. */
  requireGameOf(playerId) {
    const state = this.gameOf(playerId);
    if (!state) throw new Error("Aucune partie active.");
    return state;
  }

  /** Envoie a chaque joueur encore rattache SA vue de la partie (voir game/serialize.js). */
  broadcastState(code) {
    const state = this.games.get(code);
    if (!state) return;
    for (const playerId of this.followers(code)) {
      this.io.to(playerId).emit("state", gs.serializeForPlayer(state, playerId));
    }
  }

  /** Emet "unitMoved" pour declencher l'animation cote client quand une
   * action a deplace une unite (deplacement normal ou Charge : les deux
   * renvoient { unit | unitId, path, triggeredTraps }). Envoye a CHAQUE
   * joueur separement car une unite invisible ne doit pas fuiter son trajet
   * aux joueurs qui ne peuvent pas la voir -- meme regle que pour l'etat. */
  broadcastUnitMoved(state, result) {
    if (!result || !result.path || result.path.length < 2) return;
    const unitId = result.unitId || (result.unit && result.unit.id);
    const unit = state.units[unitId];
    if (!unit) return;
    for (const playerId of this.followers(state.code)) {
      if (!gs.isUnitVisibleTo(unit, playerId)) continue;
      this.io.to(playerId).emit("unitMoved", {
        unitId,
        path: result.path,
        triggeredTraps: result.triggeredTraps || []
      });
    }
  }

  clearTurnTimer(code) {
    clearTimeout(this.turnTimers.get(code));
    this.turnTimers.delete(code);
  }

  /** Chronometre de tour SERVEUR-AUTORITAIRE (option "turnTimerSeconds") : le
   * client se contente d'afficher un compte a rebours, il ne decide jamais
   * seul que le temps est ecoule. Idempotent : peut etre rappelee apres
   * n'importe quelle action, elle se resynchronise toujours sur l'etat reel. */
  scheduleTurnTimer(code) {
    this.clearTurnTimer(code);
    const state = this.games.get(code);
    if (!state || state.status !== "playing") return;
    const secs = state.options.turnTimerSeconds;
    if (!secs || !state.turnStartedAt) return;

    const remainingMs = Math.max(0, secs * 1000 - (Date.now() - state.turnStartedAt));
    const timer = setTimeout(() => {
      const current = this.games.get(code);
      if (!current || current.status !== "playing") return;
      try {
        const active = gs.activePlayerId(current);
        if (active) gs.endTurn(current, active);
      } catch (e) { /* le tour a peut-etre deja change entre temps, on ignore */ }
      this.broadcastState(code);
      this.scheduleTurnTimer(code);
    }, remainingMs);
    this.turnTimers.set(code, timer);
  }

  /** Nouvelle partie dans le meme salon (meme code, memes options), avec les
   * joueurs encore rattaches a la precedente ; chacun rechoisit son deck. Les
   * places des joueurs partis redeviennent libres. Retourne le code, ou null
   * si le joueur n'a pas de partie. */
  rematch(playerId) {
    const code = this.codeByPlayer.get(playerId);
    const previous = this.games.get(code);
    if (!previous) return null;

    const [hostId, ...guestIds] = previous.order.filter(id => this.isFollowing(id, code));
    const state = gs.createGame(hostId, previous.players[hostId].name, {
      maxPlayers: previous.maxPlayers,
      options: previous.options
    });
    state.code = code;
    for (const id of guestIds) gs.joinGame(state, id, previous.players[id].name);

    this.clearTurnTimer(code);
    this.games.set(code, state);
    return code;
  }

  /** Detache le joueur de sa partie (deconnexion, ou depart vers une autre
   * partie) : place liberee dans un salon, abandon dans une partie en cours.
   * La partie est retiree de la memoire si plus personne ne la suit. */
  leave(playerId) {
    const code = this.codeByPlayer.get(playerId);
    if (!code) return;
    this.codeByPlayer.delete(playerId);
    const state = this.games.get(code);
    if (!state) return;

    gs.removePlayer(state, playerId);
    if (this.followers(code).length === 0) {
      this.discard(code);
      return;
    }
    this.broadcastState(code);
    this.scheduleTurnTimer(code);
  }
}

module.exports = { GameRooms };
