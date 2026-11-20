(() => {
  "use strict";
  if (window.top !== window || window.__krillionFrEnBar) return;
  window.__krillionFrEnBar = true;

  /* ---------- 1. UI (Shadow DOM : CSS isolé, ne casse pas le jeu) ---------- */
  const host = document.createElement("div");
  host.id = "krillion-fr-en-host";
  host.style.cssText = "all:initial;position:fixed;left:0;right:0;bottom:14px;z-index:2147483647;pointer-events:none;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      .wrap {
        display: flex; flex-direction: column; align-items: center; gap: 6px;
        font: 14px/1.2 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      }
      input {
        pointer-events: auto;
        width: min(380px, 80vw);
        box-sizing: border-box;
        padding: 9px 16px;
        color: #f1f5f9;
        background: rgba(15, 23, 42, 0.78);
        border: 1px solid rgba(148, 163, 184, 0.35);
        border-radius: 999px;
        outline: none;
        font: inherit;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
        opacity: 0.55;
        transition: opacity .15s, border-color .15s, box-shadow .15s;
      }
      input::placeholder { color: #94a3b8; }
      input:hover { opacity: 0.85; }
      input:focus {
        opacity: 1;
        border-color: #38bdf8;
        box-shadow: 0 4px 18px rgba(0,0,0,.4), 0 0 0 3px rgba(56,189,248,.25);
      }
      input.busy { border-color: #fbbf24; }
      .toast {
        pointer-events: none;
        padding: 5px 12px;
        border-radius: 8px;
        color: #052e16;
        background: #4ade80;
        font-weight: 600;
        box-shadow: 0 2px 10px rgba(0,0,0,.3);
        opacity: 0; transform: translateY(4px);
        transition: opacity .12s, transform .12s;
      }
      .toast.show { opacity: 1; transform: none; }
      .toast.err { color: #450a0a; background: #f87171; }
    </style>
    <div class="wrap">
      <div class="toast" id="toast"></div>
      <input id="bar" type="text" autocomplete="off" autocapitalize="off"
             spellcheck="false" placeholder="Écris ta réponse en français + Entrée..." />
    </div>`;
  document.documentElement.appendChild(host);

  const bar = root.getElementById("bar");
  const toast = root.getElementById("toast");

  let toastTimer = 0;
  function showToast(msg, isError, ms) {
    toast.textContent = msg;
    toast.classList.toggle("err", !!isError);
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), ms || 1000);
  }

  /* ---------- 2. Traduction + nettoyage ---------- */
  const cache = new Map();

  async function translateFrToEn(text) {
    const key = text.toLowerCase();
    if (cache.has(key)) return cache.get(key);
    const res = await (globalThis.browser ?? globalThis.chrome).runtime.sendMessage({ type: "translate", text });
    if (!res || !res.ok) throw new Error((res && res.error) || "Traduction impossible");
    cache.set(key, res.text);
    return res.text;
  }

  function clean(s) {
    return s
      .normalize("NFC")
      .replace(/\s+/g, " ")
      .replace(/^[\s"'«»“”.,;:!?¿¡-]+|[\s"'«»“”.,;:!?…-]+$/g, "") // ponctuation en bord
      .toLowerCase()
      .trim();
  }

  /* ---------- 3. Repérage du champ de saisie du jeu ---------- */
  const HINT = /answer|r[ée]ponse|guess|type|word|mot|translate|input|enter|write/i;

  function isVisible(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 20 || r.height < 12) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0";
  }

  function findGameInput() {
    const nodes = document.querySelectorAll(
      'input:not([type]), input[type="text"], input[type="search"], textarea'
    );
    let best = null, bestScore = -1;
    for (const el of nodes) {
      if (el.disabled || el.readOnly || !isVisible(el)) continue;
      const hay = [el.placeholder, el.name, el.id, el.className, el.getAttribute("aria-label")]
        .filter(Boolean).join(" ");
      let score = 1;
      if (HINT.test(hay)) score += 3;
      if (el === document.activeElement) score += 2;
      if (el.closest("form")) score += 1;
      const r = el.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) score += 1; // dans la fenêtre
      if (score > bestScore) { best = el; bestScore = score; }
    }
    return best;
  }

  /* ---------- 4. Injection façon React + validation ---------- */
  function setNativeValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, value); // contourne le "value tracker" de React
  }

  function fireKey(el, type) {
    el.dispatchEvent(new KeyboardEvent(type, {
      key: "Enter", code: "Enter", keyCode: 13, which: 13,
      bubbles: true, cancelable: true, composed: true
    }));
  }

  function findSubmitButton(input) {
    const scope = input.closest("form") || input.parentElement?.parentElement || document;
    const cands = scope.querySelectorAll('button, input[type="submit"], [role="button"]');
    for (const b of cands) {
      if (b.disabled || !isVisible(b)) continue;
      const label = (b.textContent || b.value || b.getAttribute("aria-label") || "").trim();
      if (b.type === "submit" || /submit|send|ok|valid|go|enter|envoy|✓|→|➤/i.test(label)) return b;
    }
    return null;
  }

  async function sendToGame(text) {
    const input = findGameInput();
    if (!input) throw new Error("Champ du jeu introuvable");

    input.focus();
    setNativeValue(input, text);
    input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    input.dispatchEvent(new Event("change", { bubbles: true }));

    // Validation : Enter simulé…
    fireKey(input, "keydown");
    fireKey(input, "keypress");
    fireKey(input, "keyup");

    // …et si le jeu n'a rien consommé (champ intact), on clique sur le bouton.
    await new Promise((r) => setTimeout(r, 80));
    if (input.isConnected && input.value === text) {
      const form = input.closest("form");
      const btn = findSubmitButton(input);
      if (btn) btn.click();
      else if (form) form.requestSubmit ? form.requestSubmit() : form.submit();
    }
  }

  /* ---------- 5. Gestion de la barre ---------- */
  let busy = false;

  async function submit() {
    const raw = bar.value.trim();
    if (!raw || busy) return;
    busy = true;
    bar.classList.add("busy");
    try {
      const en = clean(await translateFrToEn(raw));
      if (!en) throw new Error("Traduction vide");
      await sendToGame(en);
      showToast("Traduit : " + en, false, 1000);
      bar.value = "";
    } catch (err) {
      showToast(String(err.message || err), true, 2000);
    } finally {
      busy = false;
      bar.classList.remove("busy");
      bar.focus({ preventScroll: true }); // enchaîner la réponse suivante
    }
  }

  bar.addEventListener("keydown", (e) => {
    e.stopPropagation(); // le jeu ne voit pas mes frappes (raccourcis clavier)
    if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); submit(); }
    else if (e.key === "Escape") bar.blur();
  });
  for (const t of ["keyup", "keypress"]) bar.addEventListener(t, (e) => e.stopPropagation());

  // Raccourci : Alt+T pour focus la barre depuis n'importe où.
  window.addEventListener("keydown", (e) => {
    if (e.altKey && e.key.toLowerCase() === "t") { e.preventDefault(); bar.focus(); }
  }, true);
})();
