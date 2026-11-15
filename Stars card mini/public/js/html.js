// Echappement de texte insere dans du HTML.

/** Echappe le contenu pour un usage sur dans un attribut HTML data-tooltip="...". */
export function escapeAttr(str) {
  return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
