(() => {
  "use strict";
  if (window.top !== window || window.__krillionFrEnBar) return;
  window.__krillionFrEnBar = true;

  const api = globalThis.browser ?? globalThis.chrome; // Firefox / Chrome
  const norm = (s) => String(s || "").replace(/\s+/g, " ").trim();

  /* =====================================================================
   * 1. UI (Shadow DOM : CSS isolé) — panneau + barre, tous deux déplaçables
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

      /* --- barre de saisie (dock) --- */
      .dock { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%);
        display: flex; flex-direction: column; align-items: center; gap: 6px; pointer-events: none; }
      .row { display: flex; align-items: center; gap: 6px; }
      .grip { pointer-events: auto; cursor: grab; user-select: none; touch-action: none;
        width: 26px; height: 26px; display: grid; place-items: center; border-radius: 999px;
        color: #94a3b8; background: rgba(15,23,42,.78); border: 1px solid rgba(148,163,184,.35);
        opacity: .55; font-size: 14px; }
      .grip:hover { opacity: 1; }
      .grip:active, .head:active { cursor: grabbing; }
      #bar { pointer-events: auto; width: min(380px, 70vw); padding: 9px 16px; color: #f1f5f9;
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
      .panel { position: fixed; top: 10px; right: 10px; width: 320px; max-height: 70vh;
        display: flex; flex-direction: column; pointer-events: auto; overflow: hidden;
        background: rgba(15,23,42,.86); border: 1px solid rgba(148,163,184,.3); border-radius: 12px;
        backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
        box-shadow: 0 6px 24px rgba(0,0,0,.4); opacity: .92; }
      .panel:hover { opacity: 1; }
      .head { display: flex; align-items: center; gap: 4px; padding: 6px 8px; cursor: grab;
        user-select: none; touch-action: none; border-bottom: 1px solid rgba(148,163,184,.2); }
      .head b { flex: 1; font-size: 12px; letter-spacing: .03em; color: #94a3b8; white-space: nowrap; }
      .head button { all: unset; cursor: pointer; padding: 2px 6px; border-radius: 6px;
        font-size: 12px; background: rgba(148,163,184,.15); color: #e2e8f0; }
      .head button:hover { background: rgba(56,189,248,.3); }
      .head button.on { background: #0ea5e9; color: #fff; }
      .body { overflow-y: auto; padding: 8px 10px; display: flex; flex-direction: column; gap: 8px; }
      .panel.min .body { display: none; }
      .lbl { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #64748b; }
      .q-en { font-size: 15px; font-weight: 600; color: #f8fafc; }
      .q-fr { color: #7dd3fc; }
      .mem { padding: 5px 8px; border-radius: 8px; background: rgba(250,204,21,.14);
        border: 1px solid rgba(250,204,21,.35); color: #fde68a; }
      .mem small { color: #ca8a04; }
      .hint { color: #fbbf24; font-size: 12px; }
      .chat, .help { display: flex; flex-direction: column; gap: 5px; }
      .msg { padding: 4px 8px; border-radius: 8px; background: rgba(148,163,184,.1); color: #f1f5f9; }
      .msg .t { color: #7dd3fc; }
      .tip { padding: 4px 8px; border-radius: 8px; background: rgba(52,211,153,.12);
        border: 1px solid rgba(52,211,153,.3); }
      .tip b { color: #a7f3d0; }
      .tip small { display: block; color: #6ee7b7; opacity: .75; }
      .picking-box { position: fixed; pointer-events: none; border: 2px solid #38bdf8;
        background: rgba(56,189,248,.18); border-radius: 4px; display: none; }
      .pickmsg { position: fixed; top: 10px; left: 50%; transform: translateX(-50%); display: none;
        padding: 6px 14px; border-radius: 8px; background: #0ea5e9; color: #fff; font-weight: 600; }
    </style>
    <div class="ui">
      <div class="pickmsg" id="pickmsg"></div>
      <div class="picking-box" id="pbox"></div>

      <div class="panel" id="panel">
        <div class="head" id="head" title="Glisser pour déplacer — double-clic : position d'origine">
          <b>⠿ KRILLION FR</b>
          <button id="bQ" title="Cliquer ensuite sur l'élément qui affiche la question">🎯</button>
          <button id="bC" title="Cliquer ensuite sur la zone de chat des joueurs">💬</button>
          <button id="bH" title="Aide : suggestions simples trouvées sur Internet">💡</button>
          <button id="bR" title="Remplacer le texte du jeu par sa traduction française">🔁</button>
          <button id="bX" title="Exporter la mémoire (JSON)">⬇</button>
          <button id="bM" title="Réduire / agrandir">–</button>
        </div>
        <div class="body">
          <div id="qbox">
            <div class="lbl">Question (version d'origine)</div>
            <div class="hint" id="qhint">🎯 puis clique sur la question dans le jeu.</div>
            <div class="q-en" id="qen"></div>
            <div class="q-fr" id="qfr"></div>
          </div>
          <div class="mem" id="mem" hidden></div>
          <div id="helpbox" hidden>
            <div class="lbl">💡 Aide (simple)</div>
            <div class="help" id="help"></div>
          </div>
          <div>
            <div class="lbl">Chat (version d'origine)</div>
            <div class="hint" id="chint">💬 puis clique sur la zone des messages.</div>
            <div class="chat" id="chat"></div>
          </div>
        </div>
      </div>

      <div class="dock" id="dock">
        <div class="toast" id="toast"></div>
        <div class="row">
          <div class="grip" id="grip" title="Glisser pour déplacer — double-clic : position d'origine">⠿</div>
          <input id="bar" type="text" autocomplete="off" autocapitalize="off"
                 spellcheck="false" placeholder="Écris ta réponse en français + Entrée..." />
        </div>
      </div>
    </div>`;
  document.documentElement.appendChild(host);

  const $ = (id) => root.getElementById(id);
  const bar = $("bar"), toast = $("toast"), panel = $("panel"), dock = $("dock");

  let toastTimer = 0;
  function showToast(msg, isError, ms) {
    toast.textContent = msg;
    toast.classList.toggle("err", !!isError);
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), ms || 1000);
  }

  /* =====================================================================
   * 2. Stockage
   * ===================================================================== */
  const store = {
    async get(k) { try { return (await api.storage.local.get(k))[k]; } catch (e) { return undefined; } },
    async set(k, v) { try { await api.storage.local.set({ [k]: v }); } catch (e) { /* ignore */ } },
  };

  let selectors = { question: "", chat: "" };
  let settings = { overwrite: true, help: false };
  let positions = {}; // { panel:{x,y}, dock:{x,y} }
  let memory = {};    // { clé: { q, answers:[{fr,en,n,ts}] } }

  /* =====================================================================
   * 3. Déplacement de l'interface (panneau + barre)
   * ===================================================================== */
  function place(el, x, y) {
    const r = el.getBoundingClientRect();
    x = Math.max(0, Math.min(x, innerWidth - r.width));
    y = Math.max(0, Math.min(y, innerHeight - r.height));
    Object.assign(el.style, { left: x + "px", top: y + "px", right: "auto", bottom: "auto", transform: "none" });
    return { x, y };
  }

  function makeDraggable(el, handle, key) {
    handle.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest("button")) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const dx = e.clientX - r.left, dy = e.clientY - r.top;
      handle.setPointerCapture(e.pointerId);
      const move = (ev) => { positions[key] = place(el, ev.clientX - dx, ev.clientY - dy); };
      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", up);
        store.set("krillionPos", positions);
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", up);
    });
    handle.addEventListener("dblclick", (e) => { // retour à la position d'origine
      if (e.target.closest("button")) return;
      Object.assign(el.style, { left: "", top: "", right: "", bottom: "", transform: "" });
      delete positions[key];
      store.set("krillionPos", positions);
    });
  }

  makeDraggable(panel, $("head"), "panel");
  makeDraggable(dock, $("grip"), "dock");

  window.addEventListener("resize", () => { // garde l'interface dans la fenêtre
    for (const [key, el] of [["panel", panel], ["dock", dock]]) {
      if (positions[key]) positions[key] = place(el, positions[key].x, positions[key].y);
    }
  });

  /* =====================================================================
   * 4. Traduction (via le background) + nettoyage
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
   * 5. Réécriture du texte DANS le jeu (uniquement les nœuds texte : sans danger pour React)
   * ===================================================================== */
  const originals = new Map(); // nœud texte → texte d'origine (pour pouvoir restaurer)

  function textNodes(el) {
    if (el.nodeType === 3) return el.data.trim() ? [el] : [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const out = [];
    for (let n; (n = w.nextNode()); ) if (n.data.trim()) out.push(n);
    return out;
  }

  const longest = (nodes) => nodes.reduce((a, b) => (b.data.length > a.data.length ? b : a));

  function setNodeText(node, text) {
    if (!originals.has(node)) {
      originals.set(node, node.data);
      if (originals.size > 400) originals.delete(originals.keys().next().value);
    }
    node.data = text;
  }

  function restoreAll() {
    for (const [node, orig] of originals) if (node.isConnected) node.data = orig;
    originals.clear();
  }

  /* =====================================================================
   * 6. Mémoire des réponses
   * ===================================================================== */
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
   * 7. Sélecteur d'élément (« pick »)
   * ===================================================================== */
  function cssSegment(el) {
    if (el.id && !/\d{4,}/.test(el.id)) return "#" + CSS.escape(el.id);
    let s = el.tagName.toLowerCase();
    const cls = [...el.classList].filter((c) => /^[A-Za-z][\w-]{1,30}$/.test(c) && !/\d{3,}/.test(c));
    if (cls.length) s += "." + cls.slice(0, 3).map(CSS.escape).join(".");
    return s;
  }

  function buildSelector(el) {
    const parts = [];
    for (let cur = el; cur && cur !== document.documentElement; cur = cur.parentElement) {
      let seg = cssSegment(cur);
      if (!seg.startsWith("#")) {
        const sibs = cur.parentElement ? [...cur.parentElement.children].filter((c) => c.tagName === cur.tagName) : [];
        if (sibs.filter((c) => cssSegment(c) === seg).length > 1) seg += `:nth-of-type(${sibs.indexOf(cur) + 1})`;
      }
      parts.unshift(seg);
      const sel = parts.join(" > ");
      try {
        const found = document.querySelectorAll(sel);
        if (found.length === 1 && found[0] === el) return sel;
      } catch (e) { /* sélecteur invalide : on continue */ }
      if (seg.startsWith("#")) break;
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
    if (!t) return; // clic sur l'interface : on laisse faire
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    const kind = picking;
    stopPick();
    if (kind === "question") {
      restoreAll();
      selectors.question = buildSelector(t);
      lastQ = curQ = shownFr = curFr = "";
      checkQuestion(true);
      showToast("Question sélectionnée ✓", false, 1200);
    } else {
      selectors.chat = buildSelector(t);
      $("chint").style.display = "none";
      showToast("Chat sélectionné ✓", false, 1200);
    }
    store.set("krillionSelectors", selectors);
  }, true);

  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && picking) stopPick(); }, true);

  /* =====================================================================
   * 8. Question : lecture, traduction (réécrite dans le jeu), mémoire, aide
   * ===================================================================== */
  let lastQ = "";   // question d'origine (normalisée) actuellement suivie
  let curQ = "";    // idem, utilisée pour la mémoire
  let curFr = "";   // traduction française de la question ("" si déjà en français)
  let curSrc = "en";
  let shownFr = ""; // traduction que NOUS avons écrite dans la page

  const domQuestion = () => {
    const el = resolve(selectors.question);
    return el ? norm(el.textContent) : "";
  };

  // Texte d'origine de la question, même si la page affiche notre traduction.
  const questionText = () => {
    const t = domQuestion();
    return t && t === shownFr && curQ ? curQ : t;
  };

  function applyQuestionFr() {
    const el = resolve(selectors.question);
    if (!el || !curFr || !settings.overwrite) return;
    const nodes = textNodes(el);
    if (!nodes.length) return;
    const main = longest(nodes);
    for (const n of nodes) setNodeText(n, n === main ? curFr : "");
    shownFr = norm(el.textContent);
  }

  function renderQuestionPanel() {
    $("qen").textContent = curQ;
    $("qfr").textContent = !settings.overwrite && curFr ? "→ " + curFr : "";
  }

  function renderMemory() {
    const box = $("mem");
    const a = curQ ? lookup(curQ)[0] : null;
    if (!a) { box.hidden = true; return; }
    box.hidden = false;
    box.textContent = "";
    box.append("💾 Déjà répondu : ");
    const b = document.createElement("b");
    b.textContent = `${a.fr} → ${a.en}`;
    const sm = document.createElement("small");
    sm.textContent = ` (${a.n}×) — Entrée sur barre vide pour renvoyer`;
    box.append(b, sm);
  }

  async function checkQuestion(force) {
    if (!selectors.question) return;
    const text = domQuestion();
    if (!text) {
      if (force) $("qhint").textContent = "Élément introuvable — re-clique sur 🎯.";
      return;
    }
    if (text === shownFr) return; // c'est notre propre écriture
    if (text === lastQ) {         // la page a remis l'original : on réapplique
      if (curFr) applyQuestionFr();
      return;
    }

    // nouvelle question
    lastQ = curQ = text; curFr = ""; shownFr = ""; curSrc = "en";
    $("qhint").style.display = "none";
    renderQuestionPanel();
    renderMemory();
    $("help").textContent = "";
    try {
      const r = await translate(text, "auto", "fr");
      if (curQ !== text) return; // la question a déjà changé
      curSrc = r.src || "en";
      curFr = r.src === "fr" ? "" : r.text;
      applyQuestionFr();
      renderQuestionPanel();
    } catch (e) { /* on garde l'original */ }
    if (curQ === text) loadHelp();
  }

  /* =====================================================================
   * 9. Aide : suggestions simples/évidentes trouvées sur Internet
   * ===================================================================== */
  const helpCache = new Map();

  function renderHelp(items) {
    const box = $("help");
    box.textContent = "";
    if (!items.length) { box.textContent = "Rien de simple trouvé pour cette question."; return; }
    for (const it of items) {
      const tip = document.createElement("div");
      tip.className = "tip";
      const b = document.createElement("b");
      b.textContent = it.fr || it.text;
      tip.append(b);
      if (it.fr && it.fr !== it.text) {
        const sm = document.createElement("small");
        sm.textContent = `${it.src} · ${it.text}`;
        tip.append(sm);
      } else {
        const sm = document.createElement("small");
        sm.textContent = it.src;
        tip.append(sm);
      }
      box.append(tip);
    }
  }

  async function loadHelp() {
    if (!settings.help || !curQ) return;
    const q = curQ, lang = curSrc === "fr" ? "fr" : "en";
    if (helpCache.has(q)) { renderHelp(helpCache.get(q)); return; }
    const box = $("help");
    box.textContent = "Recherche…";
    try {
      const res = await api.runtime.sendMessage({ type: "help", q, lang });
      if (!res || !res.ok) throw new Error((res && res.error) || "Aide indisponible");
      const items = await Promise.all(res.items.map(async (it) => {
        if (lang === "fr") return it;
        try { return { ...it, fr: (await translate(it.text, "en", "fr")).text }; } catch (e) { return it; }
      }));
      helpCache.set(q, items);
      if (curQ === q) renderHelp(items);
    } catch (e) {
      if (curQ === q) box.textContent = "Aide indisponible pour l'instant.";
    }
  }

  /* =====================================================================
   * 10. Chat : traduction des messages des autres joueurs (réécrits dans le jeu)
   * ===================================================================== */
  const seen = new Map(); // texte → timestamp
  const chatBox = $("chat");

  async function handleChatNode(n, depth = 0) {
    if (!n.isConnected) return;
    const full = norm(n.textContent);
    if (full.length > 400 && n.nodeType === 1 && depth < 2) { // liste entière re-rendue : message par message
      [...n.children].slice(-30).forEach((c) => handleChatNode(c, depth + 1));
      return;
    }
    if (full.length < 2 || full.length > 400 || !/\p{L}/u.test(full)) return;
    const nodes = textNodes(n);
    if (!nodes.length) return;
    const main = longest(nodes);          // le message lui-même (pas le pseudo)
    const src = norm(main.data);
    if (!/\p{L}/u.test(src)) return;

    const now = Date.now();
    let row = null, tr = null;
    if (!(seen.has(full) && now - seen.get(full) < 60000)) { // nouveau message → ligne dans le panneau
      seen.set(full, now);
      if (seen.size > 300) seen.delete(seen.keys().next().value);
      row = document.createElement("div");
      row.className = "msg";
      row.append(full);
      tr = document.createElement("div");
      tr.className = "t";
      row.append(tr);
      chatBox.append(row);
      while (chatBox.children.length > 25) chatBox.firstChild.remove();
      const scroller = chatBox.parentElement.parentElement;
      scroller.scrollTop = scroller.scrollHeight;
    }

    try {
      const r = await translate(src, "auto", "fr");
      if (r.src === "fr") { if (row) row.remove(); return; }
      if (settings.overwrite && main.isConnected && norm(main.data) === src) setNodeText(main, r.text);
      if (tr && !settings.overwrite) tr.textContent = "→ " + r.text;
    } catch (e) { /* on laisse l'original */ }
  }

  function scanChat(records) {
    const chat = resolve(selectors.chat);
    if (!chat) return;
    for (const rec of records) {
      if (rec.type !== "childList" || !chat.contains(rec.target)) continue;
      for (const n of rec.addedNodes) if (n.nodeType === 1 || n.nodeType === 3) handleChatNode(n);
    }
  }

  /* =====================================================================
   * 11. Observation unique du DOM du jeu
   * ===================================================================== */
  let qTimer = 0;
  new MutationObserver((records) => {
    scanChat(records);
    clearTimeout(qTimer);
    qTimer = setTimeout(() => checkQuestion(false), 150);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  /* =====================================================================
   * 12. Champ du jeu : repérage, injection façon React, validation
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
   * 13. Barre de saisie
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
   * 14. Boutons du panneau
   * ===================================================================== */
  const refreshToggles = () => {
    $("bH").classList.toggle("on", settings.help);
    $("bR").classList.toggle("on", settings.overwrite);
    $("helpbox").hidden = !settings.help;
  };

  $("bQ").addEventListener("click", () => (picking === "question" ? stopPick() : startPick("question")));
  $("bC").addEventListener("click", () => (picking === "chat" ? stopPick() : startPick("chat")));

  $("bH").addEventListener("click", () => {
    settings.help = !settings.help;
    store.set("krillionSettings", settings);
    refreshToggles();
    if (settings.help) loadHelp(); else $("help").textContent = "";
  });

  $("bR").addEventListener("click", () => {
    settings.overwrite = !settings.overwrite;
    store.set("krillionSettings", settings);
    refreshToggles();
    if (settings.overwrite) applyQuestionFr(); else { restoreAll(); shownFr = ""; }
    renderQuestionPanel();
    showToast(settings.overwrite ? "Texte du jeu remplacé par le français" : "Texte d'origine restauré", false, 1200);
  });

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
   * 15. Démarrage
   * ===================================================================== */
  (async () => {
    selectors = Object.assign(selectors, await store.get("krillionSelectors"));
    settings = Object.assign(settings, await store.get("krillionSettings"));
    memory = (await store.get("krillionMemory")) || {};
    positions = (await store.get("krillionPos")) || {};
    if (positions.panel) positions.panel = place(panel, positions.panel.x, positions.panel.y);
    if (positions.dock) positions.dock = place(dock, positions.dock.x, positions.dock.y);
    if (selectors.chat) $("chint").style.display = "none";
    refreshToggles();
    checkQuestion(false);
  })();
})();
