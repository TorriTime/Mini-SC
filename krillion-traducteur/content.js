(() => {
  "use strict";
  if (window.top !== window || window.__krillionFrEnBar) return;
  window.__krillionFrEnBar = true;

  const api = globalThis.browser ?? globalThis.chrome; // Firefox / Chrome

  /* =====================================================================
   * 1. UI (Shadow DOM : CSS isolé) — barre en bas + panneau en haut à droite
   * ===================================================================== */
  const host = document.createElement("div");
  host.id = "krillion-fr-en-host";
  host.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; }
      .ui { font: 13px/1.35 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #e2e8f0; }

      /* --- barre de saisie --- */
      .barwrap { position: fixed; left: 0; right: 0; bottom: 14px; display: flex;
        flex-direction: column; align-items: center; gap: 6px; }
      #bar { pointer-events: auto; width: min(380px, 80vw); padding: 9px 16px; color: #f1f5f9;
        background: rgba(15,23,42,.78); border: 1px solid rgba(148,163,184,.35); border-radius: 999px;
        outline: none; font: inherit; font-size: 14px; backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px); box-shadow: 0 4px 18px rgba(0,0,0,.35);
        opacity: .55; transition: opacity .15s, border-color .15s, box-shadow .15s; }
      #bar::placeholder { color: #94a3b8; }
      #bar:hover { opacity: .85; }
      #bar:focus { opacity: 1; border-color: #38bdf8;
        box-shadow: 0 4px 18px rgba(0,0,0,.4), 0 0 0 3px rgba(56,189,248,.25); }
      #bar.busy { border-color: #fbbf24; }
      .toast { pointer-events: none; padding: 5px 12px; border-radius: 8px; color: #052e16;
        background: #4ade80; font-weight: 600; font-size: 14px; box-shadow: 0 2px 10px rgba(0,0,0,.3);
        opacity: 0; transform: translateY(4px); transition: opacity .12s, transform .12s; }
      .toast.show { opacity: 1; transform: none; }
      .toast.err { color: #450a0a; background: #f87171; }

      /* --- panneau --- */
      .panel { position: fixed; top: 10px; right: 10px; width: 300px; max-height: 70vh;
        display: flex; flex-direction: column; pointer-events: auto; overflow: hidden;
        background: rgba(15,23,42,.86); border: 1px solid rgba(148,163,184,.3); border-radius: 12px;
        backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
        box-shadow: 0 6px 24px rgba(0,0,0,.4); opacity: .9; }
      .panel:hover { opacity: 1; }
      .head { display: flex; align-items: center; gap: 4px; padding: 6px 8px;
        border-bottom: 1px solid rgba(148,163,184,.2); }
      .head b { flex: 1; font-size: 12px; letter-spacing: .03em; color: #94a3b8; }
      .head button { all: unset; cursor: pointer; padding: 2px 7px; border-radius: 6px;
        font-size: 12px; background: rgba(148,163,184,.15); color: #e2e8f0; }
      .head button:hover { background: rgba(56,189,248,.3); }
      .head button.on { background: #0ea5e9; color: #fff; }
      .body { overflow-y: auto; padding: 8px 10px; display: flex; flex-direction: column; gap: 8px; }
      .panel.min .body { display: none; }
      .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #64748b; }
      .q-en { color: #cbd5e1; }
      .q-fr { font-size: 15px; font-weight: 600; color: #f8fafc; }
      .mem { padding: 5px 8px; border-radius: 8px; background: rgba(250,204,21,.14);
        border: 1px solid rgba(250,204,21,.35); color: #fde68a; }
      .mem small { color: #ca8a04; }
      .hint { color: #fbbf24; font-size: 12px; }
      .chat { display: flex; flex-direction: column; gap: 5px; }
      .msg { padding: 4px 8px; border-radius: 8px; background: rgba(148,163,184,.1); }
      .msg .o { color: #94a3b8; font-size: 11px; }
      .msg .t { color: #f1f5f9; }
      .picking-box { position: fixed; pointer-events: none; border: 2px solid #38bdf8;
        background: rgba(56,189,248,.18); border-radius: 4px; display: none; }
      .pickmsg { position: fixed; top: 10px; left: 50%; transform: translateX(-50%); display: none;
        padding: 6px 14px; border-radius: 8px; background: #0ea5e9; color: #fff; font-weight: 600; }
    </style>
    <div class="ui">
      <div class="pickmsg" id="pickmsg"></div>
      <div class="picking-box" id="pbox"></div>

      <div class="panel" id="panel">
        <div class="head">
          <b>KRILLION FR</b>
          <button id="bQ" title="Cliquer sur l'élément qui affiche la question">🎯 Question</button>
          <button id="bC" title="Cliquer sur la zone de chat des joueurs">💬 Chat</button>
          <button id="bX" title="Exporter la mémoire (JSON)">⬇</button>
          <button id="bM" title="Réduire / agrandir">–</button>
        </div>
        <div class="body">
          <div id="qbox">
            <div class="lbl">Question</div>
            <div class="hint" id="qhint">Clique sur « 🎯 Question » puis sur la question dans le jeu.</div>
            <div class="q-fr" id="qfr"></div>
            <div class="q-en" id="qen"></div>
          </div>
          <div class="mem" id="mem" hidden></div>
          <div>
            <div class="lbl">Chat traduit</div>
            <div class="hint" id="chint">Clique sur « 💬 Chat » puis sur la zone des messages.</div>
            <div class="chat" id="chat"></div>
          </div>
        </div>
      </div>

      <div class="barwrap">
        <div class="toast" id="toast"></div>
        <input id="bar" type="text" autocomplete="off" autocapitalize="off"
               spellcheck="false" placeholder="Écris ta réponse en français + Entrée..." />
      </div>
    </div>`;
  document.documentElement.appendChild(host);

  const $ = (id) => root.getElementById(id);
  const bar = $("bar"), toast = $("toast"), panel = $("panel");

  let toastTimer = 0;
  function showToast(msg, isError, ms) {
    toast.textContent = msg;
    toast.classList.toggle("err", !!isError);
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), ms || 1000);
  }

  /* =====================================================================
   * 2. Traduction (via le background) + nettoyage
   * ===================================================================== */
  const cache = new Map();

  async function translate(text, sl, tl) {
    const key = sl + ">" + tl + ":" + text.toLowerCase();
    if (cache.has(key)) return cache.get(key);
    const res = await api.runtime.sendMessage({ type: "translate", text, sl, tl });
    if (!res || !res.ok) throw new Error((res && res.error) || "Traduction impossible");
    const out = { text: res.text, src: res.src };
    cache.set(key, out);
    return out;
  }

  function cleanEn(s) {
    return s
      .normalize("NFC")
      .replace(/\s+/g, " ")
      .replace(/^[\s"'«»“”.,;:!?¿¡-]+|[\s"'«»“”.,;:!?…-]+$/g, "")
      .toLowerCase()
      .trim();
  }

  /* =====================================================================
   * 3. Stockage : sélecteurs choisis + mémoire des réponses
   * ===================================================================== */
  const store = {
    async get(k) { try { return (await api.storage.local.get(k))[k]; } catch (e) { return undefined; } },
    async set(k, v) { try { await api.storage.local.set({ [k]: v }); } catch (e) { /* ignore */ } },
  };

  let selectors = { question: "", chat: "" };
  let memory = {}; // { clé normalisée: { q, answers: [{fr, en, n, ts}] } }

  const normQ = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();

  function remember(question, fr, en) {
    const key = normQ(question);
    if (!key) return;
    const e = (memory[key] ||= { q: question.trim(), answers: [] });
    const i = e.answers.findIndex((a) => a.en === en);
    const a = i >= 0 ? e.answers.splice(i, 1)[0] : { fr, en, n: 0 };
    a.fr = fr; a.n++; a.ts = Date.now();
    e.answers.unshift(a);
    e.answers.length = Math.min(e.answers.length, 5);
    store.set("krillionMemory", memory);
  }

  const lookup = (question) => (memory[normQ(question)] || {}).answers || [];

  /* =====================================================================
   * 4. Sélecteur d'élément (« pick ») : l'utilisateur clique, on retient un sélecteur CSS
   * ===================================================================== */
  function cssSegment(el) {
    let s = el.tagName.toLowerCase();
    if (el.id && !/\d{4,}/.test(el.id)) return "#" + CSS.escape(el.id);
    const cls = [...el.classList].filter((c) => /^[A-Za-z][\w-]{1,30}$/.test(c) && !/\d{3,}/.test(c));
    if (cls.length) s += "." + cls.slice(0, 3).map(CSS.escape).join(".");
    return s;
  }

  function buildSelector(el) {
    const parts = [];
    let cur = el;
    while (cur && cur !== document.documentElement) {
      let seg = cssSegment(cur);
      if (!seg.startsWith("#")) {
        const sibs = cur.parentElement ? [...cur.parentElement.children].filter((c) => c.tagName === cur.tagName) : [];
        const sameSeg = sibs.filter((c) => cssSegment(c) === seg);
        if (sameSeg.length > 1) seg += `:nth-of-type(${sibs.indexOf(cur) + 1})`;
      }
      parts.unshift(seg);
      const sel = parts.join(" > ");
      try {
        const found = document.querySelectorAll(sel);
        if (found.length === 1 && found[0] === el) return sel;
      } catch (e) { /* sélecteur invalide, on continue */ }
      if (seg.startsWith("#")) break;
      cur = cur.parentElement;
    }
    return parts.join(" > ");
  }

  const resolve = (sel) => { try { return sel ? document.querySelector(sel) : null; } catch (e) { return null; } };

  let picking = null; // "question" | "chat" | null
  const pbox = $("pbox"), pickmsg = $("pickmsg");

  function startPick(kind) {
    stopPick();
    picking = kind;
    pickmsg.textContent = kind === "question"
      ? "Clique sur la QUESTION du jeu (Échap pour annuler)"
      : "Clique sur la zone de CHAT des joueurs (Échap pour annuler)";
    pickmsg.style.display = "block";
    $(kind === "question" ? "bQ" : "bC").classList.add("on");
  }

  function stopPick() {
    picking = null;
    pbox.style.display = "none";
    pickmsg.style.display = "none";
    $("bQ").classList.remove("on");
    $("bC").classList.remove("on");
  }

  const pageTarget = (e) => {
    const path = e.composedPath ? e.composedPath() : [e.target];
    const t = path[0];
    return t && t.nodeType === 1 && !path.includes(host) ? t : null;
  };

  window.addEventListener("mouseover", (e) => {
    if (!picking) return;
    const t = pageTarget(e);
    if (!t) return;
    const r = t.getBoundingClientRect();
    Object.assign(pbox.style, { display: "block", left: r.left + "px", top: r.top + "px",
      width: r.width + "px", height: r.height + "px" });
  }, true);

  window.addEventListener("click", (e) => {
    if (!picking) return;
    const t = pageTarget(e);
    if (!t) return; // clic sur le panneau : on laisse faire
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    const kind = picking;
    selectors[kind] = buildSelector(t);
    store.set("krillionSelectors", selectors);
    stopPick();
    if (kind === "question") { lastQ = ""; checkQuestion(true); }
    else { $("chint").style.display = "none"; showToast("Chat sélectionné ✓", false, 1200); }
    if (kind === "question") showToast("Question sélectionnée ✓", false, 1200);
  }, true);

  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && picking) stopPick(); }, true);

  /* =====================================================================
   * 5. Question : lecture, traduction FR, mémoire
   * ===================================================================== */
  let lastQ = "";
  let curQ = "";

  const questionText = () => {
    const el = resolve(selectors.question);
    return el ? (el.innerText || el.textContent || "").trim() : "";
  };

  function renderMemory() {
    const box = $("mem");
    const answers = curQ ? lookup(curQ) : [];
    if (!answers.length) { box.hidden = true; return; }
    const a = answers[0];
    box.hidden = false;
    box.innerHTML = "";
    const line = document.createElement("div");
    line.append("💾 Déjà répondu : ");
    const b = document.createElement("b");
    b.textContent = `${a.fr} → ${a.en}`;
    line.append(b);
    const sm = document.createElement("small");
    sm.textContent = ` (${a.n}×) — Entrée sur barre vide pour renvoyer`;
    line.append(sm);
    box.append(line);
  }

  async function checkQuestion(force) {
    if (!selectors.question) return;
    const text = questionText();
    if (!text) {
      if (force) $("qhint").textContent = "Élément introuvable — re-clique sur « 🎯 Question ».";
      return;
    }
    if (text === lastQ) return;
    lastQ = curQ = text;
    $("qhint").style.display = "none";
    $("qen").textContent = text;
    $("qfr").textContent = "…";
    renderMemory();
    try {
      const r = await translate(text, "auto", "fr");
      if (curQ !== text) return; // la question a déjà changé
      $("qfr").textContent = r.src === "fr" ? text : r.text;
      $("qen").textContent = r.src === "fr" ? "" : text;
    } catch (e) {
      if (curQ === text) $("qfr").textContent = "(traduction impossible)";
    }
  }

  /* =====================================================================
   * 6. Chat : traduction des messages des autres joueurs
   * ===================================================================== */
  const seen = new Map(); // texte → timestamp (anti-doublons / re-rendus)
  const chatBox = $("chat");

  async function handleChatText(text) {
    text = text.replace(/\s+/g, " ").trim();
    if (text.length < 2 || text.length > 400 || !/\p{L}/u.test(text)) return;
    const now = Date.now();
    if (seen.has(text) && now - seen.get(text) < 60000) return;
    seen.set(text, now);
    if (seen.size > 300) seen.delete(seen.keys().next().value);

    const row = document.createElement("div");
    row.className = "msg";
    const o = document.createElement("div"); o.className = "o"; o.textContent = text;
    const t = document.createElement("div"); t.className = "t"; t.textContent = "…";
    row.append(o, t);
    chatBox.append(row);
    while (chatBox.children.length > 25) chatBox.firstChild.remove();
    chatBox.parentElement.parentElement.scrollTop = chatBox.parentElement.parentElement.scrollHeight;

    try {
      const r = await translate(text, "auto", "fr");
      if (r.src === "fr") { t.textContent = text; o.remove(); }
      else t.textContent = r.text;
    } catch (e) { t.textContent = "(traduction impossible)"; }
  }

  function scanChat(records) {
    const chat = resolve(selectors.chat);
    if (!chat) return;
    for (const rec of records) {
      if (rec.type !== "childList" || !chat.contains(rec.target)) continue;
      for (const n of rec.addedNodes) {
        if (n.nodeType === 1 || n.nodeType === 3) handleChatText(n.textContent || "");
      }
    }
  }

  /* =====================================================================
   * 7. Observation unique du DOM du jeu (debounce)
   * ===================================================================== */
  let qTimer = 0;
  new MutationObserver((records) => {
    scanChat(records);
    clearTimeout(qTimer);
    qTimer = setTimeout(() => checkQuestion(false), 150);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  /* =====================================================================
   * 8. Champ du jeu : repérage, injection façon React, validation
   * ===================================================================== */
  const HINT = /answer|r[ée]ponse|guess|type|word|mot|translate|input|enter|write/i;

  function isVisible(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 20 || r.height < 12) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== "hidden" && cs.display !== "none" && cs.opacity !== "0";
  }

  function findGameInput() {
    const nodes = document.querySelectorAll(
      'input:not([type]), input[type="text"], input[type="search"], textarea');
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
      if (r.bottom > 0 && r.top < innerHeight) score += 1;
      if (score > bestScore) { best = el; bestScore = score; }
    }
    return best;
  }

  function setNativeValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value); // contourne le tracker React
  }

  function fireKey(el, type) {
    el.dispatchEvent(new KeyboardEvent(type, {
      key: "Enter", code: "Enter", keyCode: 13, which: 13,
      bubbles: true, cancelable: true, composed: true,
    }));
  }

  function findSubmitButton(input) {
    const scope = input.closest("form") || input.parentElement?.parentElement || document;
    for (const b of scope.querySelectorAll('button, input[type="submit"], [role="button"]')) {
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
    fireKey(input, "keydown"); fireKey(input, "keypress"); fireKey(input, "keyup");

    await new Promise((r) => setTimeout(r, 80));
    if (input.isConnected && input.value === text) { // le jeu n'a rien consommé
      const form = input.closest("form");
      const btn = findSubmitButton(input);
      if (btn) btn.click();
      else if (form) form.requestSubmit ? form.requestSubmit() : form.submit();
    }
  }

  /* =====================================================================
   * 9. Barre de saisie
   * ===================================================================== */
  let busy = false;

  async function submit() {
    if (busy) return;
    const raw = bar.value.trim();
    let fr = raw, en = "";

    busy = true;
    bar.classList.add("busy");
    try {
      if (!raw) { // barre vide : on renvoie la réponse mémorisée pour cette question
        const q = selectors.question ? questionText() : "";
        const a = q ? lookup(q)[0] : null;
        if (!a) return;
        fr = a.fr; en = a.en;
      } else {
        en = cleanEn((await translate(raw, "fr", "en")).text);
        if (!en) throw new Error("Traduction vide");
      }

      const question = selectors.question ? questionText() : ""; // lue AVANT l'envoi
      await sendToGame(en);
      if (question) { remember(question, fr, en); renderMemory(); }
      showToast("Traduit : " + en, false, 1000);
      bar.value = "";
    } catch (err) {
      showToast(String(err.message || err), true, 2000);
    } finally {
      busy = false;
      bar.classList.remove("busy");
      bar.focus({ preventScroll: true });
    }
  }

  bar.addEventListener("keydown", (e) => {
    e.stopPropagation(); // le jeu ne voit pas mes frappes
    if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); submit(); }
    else if (e.key === "Escape") bar.blur();
  });
  for (const t of ["keyup", "keypress"]) bar.addEventListener(t, (e) => e.stopPropagation());

  window.addEventListener("keydown", (e) => { // Alt+T : focus sur la barre
    if (e.altKey && e.key.toLowerCase() === "t") { e.preventDefault(); bar.focus(); }
  }, true);

  /* =====================================================================
   * 10. Boutons du panneau
   * ===================================================================== */
  $("bQ").addEventListener("click", () => (picking === "question" ? stopPick() : startPick("question")));
  $("bC").addEventListener("click", () => (picking === "chat" ? stopPick() : startPick("chat")));
  $("bM").addEventListener("click", () => {
    panel.classList.toggle("min");
    $("bM").textContent = panel.classList.contains("min") ? "+" : "–";
  });
  $("bX").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(memory, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "krillion-memoire.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    showToast(`Mémoire exportée (${Object.keys(memory).length} questions)`, false, 1500);
  });
  for (const t of ["keydown", "keyup", "keypress"]) panel.addEventListener(t, (e) => e.stopPropagation());

  /* =====================================================================
   * 11. Démarrage : recharger sélecteurs + mémoire
   * ===================================================================== */
  (async () => {
    selectors = Object.assign(selectors, await store.get("krillionSelectors"));
    memory = (await store.get("krillionMemory")) || {};
    if (selectors.chat) $("chint").style.display = "none";
    checkQuestion(false);
  })();
})();
