// Infobulles generiques : fonctionnent au survol (souris) ET au tap
// (mobile/tactile), sur tout element portant un attribut data-tooltip
// (dont la valeur est du HTML).

import { $ } from "./dom.js";

const MARGIN = 8;

function position(tooltipEl, target) {
  const rect = target.getBoundingClientRect();
  const ttRect = tooltipEl.getBoundingClientRect();
  let left = rect.left;
  let top = rect.bottom + MARGIN;
  if (left + ttRect.width > window.innerWidth - MARGIN) left = window.innerWidth - ttRect.width - MARGIN;
  if (top + ttRect.height > window.innerHeight - MARGIN) top = rect.top - ttRect.height - MARGIN;
  tooltipEl.style.left = Math.max(MARGIN, left) + "px";
  tooltipEl.style.top = Math.max(MARGIN, top) + "px";
}

export function initTooltips() {
  const tooltipEl = $("tooltip");
  const targetOf = e => e.target.closest("[data-tooltip]");

  function show(target) {
    const html = target.getAttribute("data-tooltip");
    if (!html) return;
    tooltipEl.innerHTML = html;
    tooltipEl.classList.add("visible");
    position(tooltipEl, target);
  }
  function hide() {
    tooltipEl.classList.remove("visible");
  }

  document.addEventListener("mouseover", e => {
    const target = targetOf(e);
    if (target) show(target);
  });
  document.addEventListener("mouseout", e => {
    if (targetOf(e)) hide();
  });
  // Mobile/tactile : un appui affiche l'infobulle, un appui ailleurs la ferme.
  document.addEventListener("touchstart", e => {
    const target = targetOf(e);
    if (target) show(target); else hide();
  }, { passive: true });
}
