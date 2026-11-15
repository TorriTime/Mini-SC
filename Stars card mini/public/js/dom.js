// Petits raccourcis DOM partages par tous les ecrans.

export const $ = id => document.getElementById(id);

/** Raccourci : ecouteur de clic sur l'element d'identifiant `id`. */
export function onClick(id, handler) {
  $(id).addEventListener("click", handler);
}

/** Un seul ecran (<section class="screen">) est visible a la fois. */
export function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(id).classList.add("active");
}

export function isScreenActive(id) {
  return $(id).classList.contains("active");
}
