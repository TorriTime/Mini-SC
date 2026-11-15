// Echappement de texte insere dans du HTML.

const HTML_ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Echappe un texte libre avant de l'inserer dans un gabarit HTML. A utiliser
 * pour TOUT texte saisi par un joueur (pseudo, nom de deck) : il s'affiche
 * aussi chez les autres joueurs. Les textes des donnees du jeu (data/*.js)
 * sont de confiance et peuvent contenir du HTML. */
export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => HTML_ENTITIES[ch]);
}

/** Echappe le contenu pour un usage sur dans un attribut HTML data-tooltip="...". */
export function escapeAttr(str) {
  return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
