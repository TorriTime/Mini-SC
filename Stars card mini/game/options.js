// Options de partie choisies a la creation (voir l'ecran "Configurer la
// partie" cote client). Toute valeur inconnue retombe sur la valeur par defaut.

const HAND_LIMITS = [5, 7, 9];
const TURN_TIMERS_SECONDS = [20, 40, 60];

const DEFAULT_OPTIONS = {
  retaliate: true,
  reshuffleDiscard: false,
  handLimit: null,        // null | 5 | 7 | 9
  turnTimerSeconds: null, // null | 20 | 40 | 60
  sandbox: false
};

function sanitizeOptions(raw) {
  raw = raw || {};
  return {
    retaliate: raw.retaliate !== false,
    reshuffleDiscard: !!raw.reshuffleDiscard,
    handLimit: HAND_LIMITS.includes(raw.handLimit) ? raw.handLimit : null,
    turnTimerSeconds: TURN_TIMERS_SECONDS.includes(raw.turnTimerSeconds) ? raw.turnTimerSeconds : null,
    sandbox: !!raw.sandbox
  };
}

module.exports = { DEFAULT_OPTIONS, sanitizeOptions };
