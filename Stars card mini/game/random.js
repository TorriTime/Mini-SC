// Toutes les sources d'aleatoire du moteur (identifiants, code de partie,
// melange des decks), regroupees ici.

const crypto = require("crypto");
const { GAME_CODE_LENGTH } = require("./constants");

// Sans caracteres ambigus (pas de I/O/0/1) : le code est dicte a voix haute.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function uid(prefix) {
  return `${prefix}_${crypto.randomBytes(4).toString("hex")}`;
}

function genCode() {
  let code = "";
  for (let i = 0; i < GAME_CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

/** Melange de Fisher-Yates ; retourne une COPIE, le tableau d'origine est intact. */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

module.exports = { uid, genCode, shuffle };
