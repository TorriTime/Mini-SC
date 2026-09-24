(() => {
  "use strict";

  const socket = io();

  let CARDS = [];
  let SPELLS = [];
  let CHAMPIONS = [];
  let ABILITIES = {};
  // Une carte jouable est soit une unite (CARDS) soit un sort (SPELLS) --
  // meme systeme de donnees, cardById cherche dans les deux.
  const cardById = id => CARDS.find(c => c.id === id) || SPELLS.find(s => s.id === id);
  const championById = id => CHAMPIONS.find(c => c.id === id);

  // ----------------------------------------------------------------
  // Infobulles generiques : fonctionnent au survol (souris) ET au tap
  // (mobile/tactile), sur tout element portant un attribut data-tooltip.
  // Les donnees affichees sont TOUJOURS les memes que celles envoyees par
  // le serveur/utilisees par le moteur (ABILITIES, cartes) -- jamais un
  // texte different invente cote interface.
  // ----------------------------------------------------------------
  function formatUsesLimit(usesLimit) {
    if (!usesLimit) return null;
    const parts = [];
    if (usesLimit.total != null) parts.push(`${usesLimit.total} au total`);
    if (usesLimit.perTurn != null) parts.push(`${usesLimit.perTurn} par tour`);
    return parts.join(", ");
  }

  // Echappe le contenu pour un usage sur dans un attribut HTML data-tooltip="...".
  function escapeAttr(str) {
    return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  }

  function abilityTooltipHtml(ability) {
    if (!ability) return "";
    const lines = [`<b>${ability.name}</b>`];
    if (ability.passive) lines.push(`<div class="tt-line">Passif (toujours actif)</div>`);
    else lines.push(`<div class="tt-line">Cout : ${ability.cost} mana - Portee : ${ability.range}</div>`);
    const usesLabel = formatUsesLimit(ability.uses);
    if (usesLabel) lines.push(`<div class="tt-line">Utilisations max : ${usesLabel}</div>`);
    lines.push(`<div class="tt-line">${ability.description}</div>`);
    return lines.join("");
  }

  const tooltipEl = document.getElementById("tooltip");
  function positionTooltip(target) {
    const rect = target.getBoundingClientRect();
    const ttRect = tooltipEl.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 8;
    if (left + ttRect.width > window.innerWidth - 8) left = window.innerWidth - ttRect.width - 8;
    if (top + ttRect.height > window.innerHeight - 8) top = rect.top - ttRect.height - 8;
    tooltipEl.style.left = Math.max(8, left) + "px";
    tooltipEl.style.top = Math.max(8, top) + "px";
  }
  function showTooltipFor(target) {
    const html = target.getAttribute("data-tooltip");
    if (!html) return;
    tooltipEl.innerHTML = html;
    tooltipEl.classList.add("visible");
    positionTooltip(target);
  }
  function hideTooltip() { tooltipEl.classList.remove("visible"); }

  document.addEventListener("mouseover", e => {
    const target = e.target.closest("[data-tooltip]");
    if (target) showTooltipFor(target);
  });
  document.addEventListener("mouseout", e => {
    if (e.target.closest("[data-tooltip]")) hideTooltip();
  });
  // Mobile/tactile : un appui affiche l'infobulle, un appui ailleurs la ferme.
  document.addEventListener("touchstart", e => {
    const target = e.target.closest("[data-tooltip]");
    if (target) { showTooltipFor(target); } else { hideTooltip(); }
  }, { passive: true });

  // ----------------------------------------------------------------
  // Plusieurs decks nommes et sauvegardes (localStorage, meme systeme de
  // stockage que la version precedente a un seul deck). `activeDeckId`
  // designe le deck EN COURS D'EDITION dans le deckbuilder ; le deck
  // reellement utilise pour une partie est choisi separement dans le salon
  // d'attente (voir renderDeckPicker) et n'a pas besoin d'etre le meme.
  // ----------------------------------------------------------------
  const DECKS_KEY = "starsCardsDecksV2";
  const LEGACY_DECK_KEY = "starsCardsDeck"; // ancien format mono-deck, migre si present
  const MIN_DECK_SIZE = 10;
  const DEFAULT_DECK_CARDS = ["soldier", "scout", "archer", "tank", "berserker", "militia", "healer", "knight", "heal", "strike", "draw"];

  function uid() { return "d_" + Math.random().toString(36).slice(2, 10); }

  function loadDecks() {
    try {
      const raw = JSON.parse(localStorage.getItem(DECKS_KEY));
      if (Array.isArray(raw) && raw.length > 0) return raw;
    } catch (e) { /* ignore */ }
    let legacy = null;
    try { legacy = JSON.parse(localStorage.getItem(LEGACY_DECK_KEY)); } catch (e) { /* ignore */ }
    const base = (legacy && Array.isArray(legacy.cardIds) && legacy.cardIds.length >= MIN_DECK_SIZE)
      ? legacy
      : { championId: "kael", cardIds: DEFAULT_DECK_CARDS.slice() };
    return [{ id: uid(), name: "Deck 1", championId: base.championId, cardIds: base.cardIds.slice() }];
  }
  function saveDecks() { localStorage.setItem(DECKS_KEY, JSON.stringify(myDecks)); }

  let myDecks = loadDecks();
  let activeDeckId = myDecks[0].id;
  function currentDeck() { return myDecks.find(d => d.id === activeDeckId) || myDecks[0]; }
  function deckIsValid(deck) { return (deck || currentDeck()).cardIds.length >= MIN_DECK_SIZE; }

  function createNewDeck() {
    const d = { id: uid(), name: `Deck ${myDecks.length + 1}`, championId: (CHAMPIONS[0] && CHAMPIONS[0].id) || "kael", cardIds: [] };
    myDecks.push(d);
    activeDeckId = d.id;
    saveDecks();
    renderDeckBuilder();
  }
  function duplicateActiveDeck() {
    const src = currentDeck();
    const d = { id: uid(), name: src.name + " (copie)", championId: src.championId, cardIds: src.cardIds.slice() };
    myDecks.push(d);
    activeDeckId = d.id;
    saveDecks();
    renderDeckBuilder();
  }
  function deleteActiveDeck() {
    if (myDecks.length <= 1) return; // toujours garder au moins un deck
    myDecks = myDecks.filter(d => d.id !== activeDeckId);
    activeDeckId = myDecks[0].id;
    saveDecks();
    renderDeckBuilder();
  }
  function renameActiveDeck() {
    const d = currentDeck();
    const name = window.prompt("Nom du deck :", d.name);
    if (name && name.trim()) { d.name = name.trim(); saveDecks(); renderDeckBuilder(); }
  }

  // ----------------------------------------------------------------
  // Ecrans
  // ----------------------------------------------------------------
  function showScreen(id) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    document.getElementById(id).classList.add("active");
  }

  function playerName() {
    const v = document.getElementById("input-player-name").value.trim();
    return v || "Joueur";
  }

  // ----------------------------------------------------------------
  // Chargement des donnees publiques
  // ----------------------------------------------------------------
  let PATCH_NOTES = [];
  Promise.all([
    // cache: "no-store" : toujours prendre les donnees fraiches du serveur
    // (evite un ancien Soin/Frappe/etc. affiche apres une modif + redemarrage).
    fetch("/api/cards", { cache: "no-store" }).then(r => r.json()),
    fetch("/api/spells", { cache: "no-store" }).then(r => r.json()),
    fetch("/api/champions", { cache: "no-store" }).then(r => r.json()),
    fetch("/api/abilities", { cache: "no-store" }).then(r => r.json()),
    fetch("/api/patchnotes", { cache: "no-store" }).then(r => r.json())
  ]).then(([cards, spells, champions, abilities, patchNotes]) => {
    CARDS = cards;
    SPELLS = spells;
    CHAMPIONS = champions;
    ABILITIES = abilities;
    PATCH_NOTES = patchNotes;
    renderDeckBuilder();
    renderPatchNotes();
    const versionTag = document.getElementById("version-tag");
    if (versionTag && patchNotes[0]) versionTag.textContent = `Version ${patchNotes[0].version}`;
  });

  function renderPatchNotes() {
    const el = document.getElementById("patchnotes-list");
    if (!el) return;
    el.innerHTML = PATCH_NOTES.map(entry => `
      <div class="patch-entry">
        <h3>Version ${entry.version}</h3>
        ${entry.title ? `<p class="patch-title">${entry.title}</p>` : ""}
        <ul>${entry.changes.map(c => `<li>${c}</li>`).join("")}</ul>
      </div>
    `).join("");
  }
  document.getElementById("btn-patchnotes").addEventListener("click", () => showScreen("screen-patchnotes"));
  document.getElementById("btn-patchnotes-back").addEventListener("click", () => showScreen("screen-menu"));

  // ----------------------------------------------------------------
  // Menu principal / navigation
  // ----------------------------------------------------------------
  document.getElementById("btn-create").addEventListener("click", () => showScreen("screen-options"));
  document.getElementById("btn-join").addEventListener("click", () => showScreen("screen-join"));
  document.getElementById("btn-deck").addEventListener("click", () => { renderDeckBuilder(); showScreen("screen-deck"); });
  document.getElementById("btn-create-back").addEventListener("click", () => showScreen("screen-menu"));
  document.getElementById("btn-join-back").addEventListener("click", () => showScreen("screen-menu"));
  document.getElementById("btn-options-back").addEventListener("click", () => showScreen("screen-menu"));

  // Deck < 10 cartes : impossible de quitter le deckbuilder ou de lancer
  // une partie tant que ce n'est pas corrige (le joueur peut continuer a
  // modifier son deck librement, seule la sortie/le lancement est bloque).
  document.getElementById("btn-deck-back").addEventListener("click", () => {
    if (!deckIsValid()) { updateDeckWarning(); return; }
    showScreen("screen-menu");
  });

  document.getElementById("btn-join-confirm").addEventListener("click", () => {
    const code = document.getElementById("input-join-code").value;
    socket.emit("joinGame", { code, name: playerName() });
  });

  document.getElementById("btn-end-turn").addEventListener("click", () => socket.emit("endTurn"));
  document.getElementById("btn-rematch").addEventListener("click", () => socket.emit("rematch"));
  document.getElementById("btn-end-menu").addEventListener("click", () => showScreen("screen-menu"));

  socket.on("errorMessage", msg => {
    const banner = document.getElementById("game-banner");
    const joinStatus = document.getElementById("join-status");
    if (document.getElementById("screen-game").classList.contains("active")) {
      banner.textContent = msg;
      setTimeout(() => { if (banner.textContent === msg) banner.textContent = ""; }, 2500);
    } else {
      joinStatus.textContent = msg;
    }
  });

  // Le serveur attend { championId, deckCardIds, deckName } (voir
  // game/gameState.js#setPlayerLoadout). Chaque joueur choisit
  // INDEPENDAMMENT lequel de SES decks sauvegardes utiliser pour cette
  // partie via le selecteur du salon d'attente (renderDeckPicker) -- il
  // n'y a plus d'envoi automatique a la creation/connexion.
  function emitLoadout(deck) {
    socket.emit("setLoadout", { championId: deck.championId, deckCardIds: deck.cardIds, deckName: deck.name });
  }

  // ----------------------------------------------------------------
  // Options de partie (ecran avant creation)
  // ----------------------------------------------------------------
  const gameOptions = {
    maxPlayers: 2,
    retaliate: true,
    reshuffleDiscard: false,
    handLimit: null,
    turnTimerSeconds: null,
    sandbox: false
  };

  function wireChoiceGroup(containerId, apply, parse) {
    const container = document.getElementById(containerId);
    container.querySelectorAll(".choice-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        container.querySelectorAll(".choice-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        apply(parse(btn.dataset.value));
      });
    });
  }
  wireChoiceGroup("opt-maxplayers", v => { gameOptions.maxPlayers = v; }, v => Number(v));
  wireChoiceGroup("opt-retaliate", v => { gameOptions.retaliate = v; }, v => v === "true");
  wireChoiceGroup("opt-reshuffle", v => { gameOptions.reshuffleDiscard = v; }, v => v === "true");
  wireChoiceGroup("opt-handlimit", v => { gameOptions.handLimit = v; }, v => v ? Number(v) : null);
  wireChoiceGroup("opt-timer", v => { gameOptions.turnTimerSeconds = v; }, v => v ? Number(v) : null);
  wireChoiceGroup("opt-sandbox", v => { gameOptions.sandbox = v; }, v => v === "true");

  document.getElementById("btn-options-create").addEventListener("click", () => {
    if (!deckIsValid()) { renderDeckBuilder(); updateDeckWarning(); showScreen("screen-deck"); return; }
    socket.emit("createGame", { name: playerName(), maxPlayers: gameOptions.maxPlayers, options: gameOptions });
  });

  // ----------------------------------------------------------------
  // Salon d'attente : copier le code + liste des joueurs + options
  // ----------------------------------------------------------------
  function copyWithExecCommand(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }

  document.getElementById("btn-copy-code").addEventListener("click", async () => {
    const code = document.getElementById("create-code").textContent;
    const feedback = document.getElementById("copy-feedback");
    // Essaie l'API Clipboard moderne, puis retombe sur execCommand si elle
    // est absente OU refuse (permission navigateur, contexte automatise...).
    let copied = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(code);
        copied = true;
      } catch (e) { /* on retente via le fallback ci-dessous */ }
    }
    if (!copied) {
      try { copied = copyWithExecCommand(code); } catch (e) { copied = false; }
    }
    feedback.textContent = copied
      ? "Code copie !"
      : "Impossible de copier automatiquement, selectionne le code manuellement.";
    if (copied) setTimeout(() => { if (feedback.textContent === "Code copie !") feedback.textContent = ""; }, 2000);
  });

  function renderLobbyPlayers(state) {
    const el = document.getElementById("lobby-players");
    el.innerHTML = "";
    for (let i = 0; i < state.maxPlayers; i++) {
      const id = state.order[i];
      const row = document.createElement("div");
      row.className = "lobby-player-row";
      if (id) {
        const p = state.players[id];
        const status = p.ready ? `Deck : ${p.deckName || "?"}` : "Choisit son deck...";
        row.innerHTML = `<span>${p.name}${id === state.you ? " (toi)" : ""}</span><span class="status">${status}</span>`;
      } else {
        row.innerHTML = `<span>En attente...</span><span class="status empty">Place libre</span>`;
      }
      el.appendChild(row);
    }
  }

  // Choix INDEPENDANT du deck a utiliser pour CETTE partie, parmi les decks
  // sauvegardes du joueur. Reste affiche tant que le joueur n'a pas confirme
  // (ready === false) ; une fois confirme, le deck est verrouille pour la partie.
  let selectedDeckIdForGame = null;
  function renderDeckPicker(state) {
    const container = document.getElementById("lobby-deck-picker");
    const myself = state.players[state.you];
    if (!myself || myself.ready) { container.style.display = "none"; container.innerHTML = ""; return; }
    if (!selectedDeckIdForGame || !myDecks.some(d => d.id === selectedDeckIdForGame)) {
      selectedDeckIdForGame = currentDeck().id;
    }
    container.style.display = "";
    container.innerHTML = `
      <h3>Choisis ton deck pour cette partie</h3>
      <div id="lobby-deck-list" class="lobby-deck-list"></div>
      <button id="btn-confirm-deck">CONFIRMER MON DECK</button>
      <p id="lobby-deck-warning" class="deck-warning"></p>
    `;
    const list = document.getElementById("lobby-deck-list");
    myDecks.forEach(d => {
      const row = document.createElement("div");
      row.className = "lobby-deck-option" + (d.id === selectedDeckIdForGame ? " selected" : "");
      const champ = championById(d.championId);
      row.innerHTML = `<b>${d.name}</b><span class="stats">${d.cardIds.length} cartes - ${champ ? champ.name : "?"}</span>`;
      row.addEventListener("click", () => { selectedDeckIdForGame = d.id; renderDeckPicker(state); });
      list.appendChild(row);
    });
    document.getElementById("btn-confirm-deck").addEventListener("click", () => {
      const chosen = myDecks.find(d => d.id === selectedDeckIdForGame);
      if (!chosen || !deckIsValid(chosen)) {
        document.getElementById("lobby-deck-warning").textContent = `Ce deck contient moins de ${MIN_DECK_SIZE} cartes : complete-le dans "Mon Deck" avant de l'utiliser.`;
        return;
      }
      emitLoadout(chosen);
    });
  }

  function renderLobbyOptions(state) {
    const el = document.getElementById("lobby-options");
    const o = state.options;
    el.innerHTML = `
      <span>Joueurs : ${state.maxPlayers}</span>
      <span>Riposte : ${o.retaliate ? "Oui" : "Non"}</span>
      <span>Remelange defausse : ${o.reshuffleDiscard ? "Oui" : "Non"}</span>
      <span>Limite main : ${o.handLimit ? o.handLimit + " cartes" : "Non"}</span>
      <span>Chrono : ${o.turnTimerSeconds ? o.turnTimerSeconds + "s" : "Non"}</span>
      <span>Bac a sable : ${o.sandbox ? "Oui" : "Non"}</span>
    `;
  }

  // ----------------------------------------------------------------
  // Deck builder
  // ----------------------------------------------------------------
  function countInDeck(cardId) {
    return currentDeck().cardIds.filter(id => id === cardId).length;
  }

  function updateDeckWarning() {
    const el = document.getElementById("deck-warning");
    const missing = MIN_DECK_SIZE - currentDeck().cardIds.length;
    el.textContent = missing > 0
      ? `Il manque ${missing} carte(s) pour atteindre le minimum de ${MIN_DECK_SIZE}. Impossible de lancer une partie ou de quitter ce menu.`
      : "";
  }

  // ---- Filtres (recherche cumulable : OU dans une categorie, ET entre categories) ----
  const filters = {
    costs: new Set(),
    types: new Set(),
    classes: new Set(),
    races: new Set(),
    roles: new Set(),
    sort: null // "asc" | "desc" | null
  };

  function uniqueValues(key) {
    const vals = new Set();
    [...CARDS, ...SPELLS].forEach(c => { if (c[key]) vals.add(c[key]); });
    return [...vals].sort();
  }

  function renderFilterChips(containerId, values, selectedSet, labelFn) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = "";
    values.forEach(v => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip" + (selectedSet.has(v) ? " selected" : "");
      btn.textContent = labelFn ? labelFn(v) : v;
      btn.addEventListener("click", () => {
        if (selectedSet.has(v)) selectedSet.delete(v); else selectedSet.add(v);
        renderDeckBuilder();
      });
      el.appendChild(btn);
    });
  }

  document.querySelectorAll("[data-sort]").forEach(btn => {
    btn.addEventListener("click", () => {
      filters.sort = filters.sort === btn.dataset.sort ? null : btn.dataset.sort;
      renderDeckBuilder();
    });
  });

  document.getElementById("btn-filters-reset").addEventListener("click", () => {
    filters.costs.clear(); filters.types.clear(); filters.classes.clear();
    filters.races.clear(); filters.roles.clear(); filters.sort = null;
    renderDeckBuilder();
  });

  function cardMatchesFilters(card) {
    if (filters.costs.size > 0 && !filters.costs.has(card.cost)) return false;
    if (filters.types.size > 0 && !filters.types.has(card.type)) return false;
    if (filters.classes.size > 0 && !(card.class && filters.classes.has(card.class))) return false;
    if (filters.races.size > 0 && !(card.race && filters.races.has(card.race))) return false;
    if (filters.roles.size > 0 && !(card.role && filters.roles.has(card.role))) return false;
    return true;
  }

  function applyFilters(list) {
    let out = list.filter(cardMatchesFilters);
    if (filters.sort) {
      out = out.slice().sort((a, b) => filters.sort === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
    }
    return out;
  }

  function renderDeckToolbar() {
    const el = document.getElementById("deck-toolbar");
    if (!el) return;
    const select = document.createElement("select");
    select.id = "deck-select";
    myDecks.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = `${d.name} (${d.cardIds.length})`;
      if (d.id === activeDeckId) opt.selected = true;
      select.appendChild(opt);
    });
    select.addEventListener("change", () => { activeDeckId = select.value; renderDeckBuilder(); });

    el.innerHTML = "";
    el.appendChild(select);
    const btnNew = document.createElement("button");
    btnNew.type = "button"; btnNew.className = "secondary"; btnNew.textContent = "Nouveau";
    btnNew.addEventListener("click", createNewDeck);
    const btnRename = document.createElement("button");
    btnRename.type = "button"; btnRename.className = "secondary"; btnRename.textContent = "Renommer";
    btnRename.addEventListener("click", renameActiveDeck);
    const btnDup = document.createElement("button");
    btnDup.type = "button"; btnDup.className = "secondary"; btnDup.textContent = "Dupliquer";
    btnDup.addEventListener("click", duplicateActiveDeck);
    const btnDel = document.createElement("button");
    btnDel.type = "button"; btnDel.className = "danger"; btnDel.textContent = "Supprimer";
    btnDel.disabled = myDecks.length <= 1;
    btnDel.addEventListener("click", () => {
      if (window.confirm(`Supprimer definitivement le deck "${currentDeck().name}" ?`)) deleteActiveDeck();
    });
    el.appendChild(btnNew);
    el.appendChild(btnRename);
    el.appendChild(btnDup);
    el.appendChild(btnDel);
  }

  function renderDeckBuilder() {
    if (CARDS.length === 0) return;
    renderDeckToolbar();
    const myDeck = currentDeck();

    const champPicker = document.getElementById("champion-picker");
    champPicker.innerHTML = "";
    CHAMPIONS.forEach(champ => {
      const div = document.createElement("div");
      div.className = "champion-option" + (myDeck.championId === champ.id ? " selected" : "");
      const champAbility = (champ.abilities || [])[0] ? ABILITIES[champ.abilities[0]] : null;
      const tooltipBits = [];
      if (champ.passive) tooltipBits.push(`<div class="tt-line"><b>${champ.passive.name}</b> (passif) - ${champ.passive.description}</div>`);
      if (champAbility) tooltipBits.push(abilityTooltipHtml(champAbility));
      div.setAttribute("data-tooltip", escapeAttr(`<b>${champ.name}</b><div class="tt-line">${champ.description}</div>` + tooltipBits.join("")));
      div.innerHTML = `<h4>${champ.name}</h4><small>ATQ ${champ.attack} - PV ${champ.health} - MOV ${champ.movement} - PORTEE ${champ.range}</small>`;
      div.addEventListener("click", () => {
        myDeck.championId = champ.id;
        saveDecks();
        renderDeckBuilder();
        showCardDetail(champ, true);
      });
      champPicker.appendChild(div);
    });

    // Filtres : cout fixe 1-15 (cahier des charges), le reste lit les
    // valeurs REELLEMENT presentes dans les donnees (jamais codees en dur).
    renderFilterChips("filter-cost", Array.from({ length: 15 }, (_, i) => i + 1), filters.costs);
    renderFilterChips("filter-type", uniqueValues("type"), filters.types, v => v === "unit" ? "Pion" : v === "spell" ? "Sort" : v);
    renderFilterChips("filter-class", uniqueValues("class"), filters.classes);
    renderFilterChips("filter-race", uniqueValues("race"), filters.races);
    renderFilterChips("filter-role", uniqueValues("role"), filters.roles);
    document.querySelectorAll("[data-sort]").forEach(btn => {
      btn.classList.toggle("selected", filters.sort === btn.dataset.sort);
    });

    // Le pool affiche les unites puis les sorts, filtres/tries instantanement.
    const poolList = document.getElementById("card-pool-list");
    poolList.innerHTML = "";
    applyFilters([...CARDS, ...SPELLS]).forEach(card => {
      const row = document.createElement("div");
      row.className = "card-row";
      row.innerHTML = `
        <div>
          <div><b>${card.name}</b> <span class="cost">(${card.cost})</span>${card.type === "spell" ? ' <span class="spell-tag">SORT</span>' : ""}</div>
          <div class="stats">${cardStatsLine(card)}</div>
        </div>
        <button ${countInDeck(card.id) >= 2 ? "disabled" : ""}>+ (${countInDeck(card.id)}/2)</button>
      `;
      row.querySelector("div").addEventListener("click", () => showCardDetail(card, false));
      row.querySelector("button").addEventListener("click", e => {
        e.stopPropagation();
        if (countInDeck(card.id) < 2) {
          myDeck.cardIds.push(card.id);
          saveDecks();
          renderDeckBuilder();
        }
      });
      poolList.appendChild(row);
    });

    // Le deck lui-meme n'est jamais filtre : ce qui y est ajoute y reste visible.
    const deckList = document.getElementById("deck-list");
    deckList.innerHTML = "";
    const uniqueIds = [...new Set(myDeck.cardIds)];
    uniqueIds.forEach(id => {
      const card = cardById(id);
      const row = document.createElement("div");
      row.className = "card-row";
      row.innerHTML = `
        <div>
          <div><b>${card.name}</b> x${countInDeck(id)}${card.type === "spell" ? ' <span class="spell-tag">SORT</span>' : ""}</div>
          <div class="stats">${cardStatsLine(card)}</div>
        </div>
        <button>-</button>
      `;
      row.querySelector("div").addEventListener("click", () => showCardDetail(card, false));
      row.querySelector("button").addEventListener("click", e => {
        e.stopPropagation();
        const idx = myDeck.cardIds.indexOf(id);
        if (idx !== -1) myDeck.cardIds.splice(idx, 1);
        saveDecks();
        renderDeckBuilder();
      });
      deckList.appendChild(row);
    });

    document.getElementById("deck-count").textContent = myDeck.cardIds.length;
    updateDeckWarning();
  }

  function cardStatsLine(card) {
    if (card.type === "spell") return `Sort a ${card.cost} mana`;
    return `ATQ ${card.attack} - PV ${card.health} - MOV ${card.movement} - PORTEE ${card.range}`;
  }

  function showCardDetail(entity, isChampion) {
    const panel = document.getElementById("card-detail");
    if (entity.type === "spell") {
      panel.innerHTML = `
        <h3>${entity.name} <span class="spell-tag">SORT</span></h3>
        <div class="info-stats"><span>Cout: ${entity.cost} mana</span></div>
        <p>${entity.description}</p>
      `;
      return;
    }
    const abilitiesHtml = (entity.abilities || []).map(aid => {
      const a = ABILITIES[aid];
      if (!a) return "";
      const costLabel = a.passive ? "passif" : `cout ${a.cost}, portee ${a.range}`;
      return `<li data-tooltip="${escapeAttr(abilityTooltipHtml(a))}"><b>${a.name}</b> (${costLabel}) - ${a.description}</li>`;
    }).join("");
    const metaBits = [entity.class, entity.race, entity.role].filter(Boolean);
    panel.innerHTML = `
      <h3>${entity.name}${isChampion ? " (Champion)" : ""}</h3>
      ${metaBits.length ? `<div class="info-stats">${metaBits.map(m => `<span>${m}</span>`).join("")}</div>` : ""}
      <div class="info-stats">
        ${!isChampion ? `<span>Cout: ${entity.cost}</span>` : ""}
        <span>Attaque: ${entity.attack}</span>
        <span>PV: ${entity.health}</span>
        <span>Deplacement: ${entity.movement}</span>
        <span>Portee: ${entity.range}</span>
      </div>
      <p>${entity.description}</p>
      ${entity.passive ? `<p><b>Passif - ${entity.passive.name}:</b> ${entity.passive.description}</p>` : ""}
      ${abilitiesHtml ? `<ul>${abilitiesHtml}</ul>` : ""}
    `;
  }

  // ----------------------------------------------------------------
  // Plateau hexagonal (pixels)
  // ----------------------------------------------------------------
  // Le plateau est un vrai RECTANGLE en coordonnees "offset" (colonne/ligne,
  // disposition "odd-q" pour hexagones a sommet plat) -- meme conversion que
  // cote serveur (game/hexGrid.js) -- afin d'obtenir une arene compacte et
  // large plutot qu'un losange etire. Les q,r (axiaux) restent utilises tels
  // quels pour toute la logique de jeu (distance, deplacement, cle d'unite).
  const HEX_SIZE = 34;
  function offsetToAxial(col, row) {
    const q = col;
    const r = row - (col - (col & 1)) / 2;
    return { q, r };
  }
  function hexPixel(col, row) {
    const x = HEX_SIZE * 1.5 * col;
    const y = HEX_SIZE * Math.sqrt(3) * (row + 0.5 * (col & 1));
    return { x, y };
  }
  function cubeDistance(a, b) {
    const ax = a.q, az = a.r, ay = -ax - az;
    const bx = b.q, bz = b.r, by = -bx - bz;
    return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(az - bz));
  }

  // Reproduit exactement la meme repartition des zones de deploiement que
  // game/hexGrid.js#deployZone (haut/bas = 2 lignes completes, gauche/droite
  // = 2 colonnes sur les lignes du milieu, sans chevauchement aux coins),
  // pour une grille a 2 OU 4 joueurs. Une seule grille logique cote serveur ;
  // ceci ne fait que reproduire cote client la meme regle geometrique pour
  // savoir quelles cases colorier / rendre cliquables.
  function deployZoneCells(side, cols, rows) {
    const EDGE = 2;
    const cells = [];
    if (side === "bottom" || side === "top") {
      const rowsSet = side === "bottom" ? [rows - 1, rows - 2] : [0, 1];
      for (let row = 0; row < rows; row++) {
        if (!rowsSet.includes(row)) continue;
        for (let col = 0; col < cols; col++) cells.push(offsetToAxial(col, row));
      }
    } else if (side === "left" || side === "right") {
      const colsSet = side === "left" ? [0, 1] : [cols - 1, cols - 2];
      for (let row = EDGE; row < rows - EDGE; row++) {
        for (let col = 0; col < cols; col++) {
          if (!colsSet.includes(col)) continue;
          cells.push(offsetToAxial(col, row));
        }
      }
    }
    return cells;
  }

  // Une seule grille logique cote serveur (voir game/hexGrid.js). Chaque
  // joueur voit SON cote en bas de son ecran grace a une simple rotation
  // CSS du conteneur #board (0/90/180/270 selon son siege) : les cases
  // restent les memes elements DOM lies aux memes coordonnees q,r, donc les
  // clics restent corrects sans aucun recalcul de coordonnees.
  const SEAT_ROTATION = { bottom: 0, right: 90, top: 180, left: 270 };

  // ----------------------------------------------------------------
  // Etat de jeu cote client (selection / interactions)
  // ----------------------------------------------------------------
  let lastState = null;
  let selectedHand = null;   // {instanceId, card}
  let selectedUnitId = null; // toujours une de MES unites (panneau bleu, a gauche)
  let inspectedEnemyId = null; // unite adverse consultee (panneau rouge, a droite)
  let reachableCells = [];   // [{q,r}] pour l'unite selectionnee
  let armedAbility = null;   // {abilityId, ability}
  let turnTimerInterval = null;
  let animations = {};       // unitId -> {q,r} : position affichee PENDANT une animation de deplacement

  function clearSelection() {
    selectedHand = null;
    selectedUnitId = null;
    inspectedEnemyId = null;
    reachableCells = [];
    armedAbility = null;
  }

  socket.on("state", state => {
    lastState = state;
    if (state.status === "waiting") {
      document.getElementById("create-code").textContent = state.code;
      const count = state.order.length;
      document.getElementById("create-status").textContent =
        count < state.maxPlayers ? `En attente de ${state.maxPlayers - count} joueur(s)...` : "En attente de la configuration des decks...";
      renderLobbyPlayers(state);
      renderLobbyOptions(state);
      renderDeckPicker(state);
      showScreen("screen-create");
    } else if (state.status === "playing") {
      showScreen("screen-game");
      renderGame(state);
    } else if (state.status === "finished") {
      if (turnTimerInterval) { clearInterval(turnTimerInterval); turnTimerInterval = null; }
      const winnerName = state.players[state.winnerId] ? state.players[state.winnerId].name : "Personne";
      document.getElementById("end-title").textContent = state.winnerId ? `${winnerName} remporte la partie !` : "Partie terminee.";
      showScreen("screen-end");
    }
  });

  // Deplacement anime : le serveur envoie le chemin REEL (calcule et valide
  // par lui, voir game/movement.js#shortestPath) juste avant l'etat mis a
  // jour. On fait "sauter" le jeton d'une case a l'autre en re-rendant le
  // plateau a chaque etape -- la position finale, elle, vient toujours de
  // l'etat serveur (aucune donnee de position n'est inventee cote client).
  const MOVE_STEP_MS = 160;
  socket.on("unitMoved", ({ unitId, path }) => {
    if (!path || path.length < 2) return;
    if (animations[unitId] && animations[unitId].timer) clearInterval(animations[unitId].timer);
    let i = 0;
    animations[unitId] = { q: path[0].q, r: path[0].r, timer: null };
    const timer = setInterval(() => {
      i++;
      if (i >= path.length) {
        clearInterval(timer);
        delete animations[unitId];
        if (lastState) renderBoard(lastState);
        return;
      }
      animations[unitId] = { q: path[i].q, r: path[i].r, timer };
      if (lastState) renderBoard(lastState);
    }, MOVE_STEP_MS);
    animations[unitId].timer = timer;
    if (lastState) renderBoard(lastState);
  });

  function othersOf(state) {
    return state.order.filter(id => id !== state.you);
  }

  function championUnitOf(state, playerId) {
    return Object.values(state.units).find(u => u.isChampion && u.ownerId === playerId);
  }

  function renderGame(state) {
    const me = state.you;
    const myPlayer = state.players[me];

    // Bannière tour
    const banner = document.getElementById("game-banner");
    const activeName = state.activePlayerId ? state.players[state.activePlayerId].name : "?";
    banner.textContent = state.activePlayerId === me ? "A TOI DE JOUER" : `Tour de ${activeName}`;

    document.getElementById("sandbox-badge").classList.toggle("active", !!state.options.sandbox);
    updateTurnTimer(state);

    // Mon champion + mana
    updateChampionBadge("champion-badge-player", championUnitOf(state, me));
    document.getElementById("mana-badge-player").textContent = `Mana: ${myPlayer.mana}/${myPlayer.maxMana}`;

    // Adversaires (1 en 2 joueurs, jusqu'a 3 en 4 joueurs)
    const oppRow = document.getElementById("opponent-row");
    oppRow.innerHTML = "";
    othersOf(state).forEach(oppId => {
      const oppPlayer = state.players[oppId];
      const champ = championUnitOf(state, oppId);
      const hpPct = champ ? Math.max(0, Math.round((champ.health / champ.maxHealth) * 100)) : 0;
      const div = document.createElement("div");
      div.className = "mini-champion-badge" + (oppPlayer.eliminated ? " eliminated" : "");
      div.innerHTML = `
        <div class="champion-name">${oppPlayer.name}${oppPlayer.eliminated ? " - elimine" : (champ && champ.health <= 0 ? " - KO" : "")}</div>
        <div class="hp-bar"><div class="hp-fill" style="width:${hpPct}%; background:${hpPct > 50 ? "#6bcf6b" : hpPct > 20 ? "#e0b34d" : "#e06060"};"></div></div>
        <div class="mana-badge">Mana: ${oppPlayer.mana}/${oppPlayer.maxMana}</div>
      `;
      oppRow.appendChild(div);
    });

    renderHand(state, myPlayer);
    renderBoard(state);

    document.getElementById("btn-end-turn").disabled = state.activePlayerId !== me;
    document.getElementById("btn-forfeit").disabled = myPlayer.eliminated;
  }

  function updateTurnTimer(state) {
    const el = document.getElementById("turn-timer");
    if (turnTimerInterval) { clearInterval(turnTimerInterval); turnTimerInterval = null; }
    if (state.turnRemainingSeconds == null) { el.textContent = ""; return; }
    // Purement un affichage : le SERVEUR est seul juge du moment ou le tour
    // se termine reellement (voir server.js#scheduleTurnTimer). Ce compte a
    // rebours local ne fait qu'interpoler entre deux mises a jour d'etat.
    let remaining = state.turnRemainingSeconds;
    const render = () => { el.textContent = `Temps restant : ${remaining}s`; };
    render();
    turnTimerInterval = setInterval(() => {
      remaining = Math.max(0, remaining - 1);
      render();
      if (remaining <= 0) { clearInterval(turnTimerInterval); turnTimerInterval = null; }
    }, 1000);
  }

  function updateChampionBadge(elId, unit) {
    const el = document.getElementById(elId);
    const nameEl = el.querySelector(".champion-name");
    const fillEl = el.querySelector(".hp-fill");
    if (!unit) { nameEl.textContent = "?"; fillEl.style.width = "0%"; return; }
    const pct = Math.max(0, Math.round((unit.health / unit.maxHealth) * 100));
    nameEl.textContent = `${unit.name} (${unit.health}/${unit.maxHealth})${unit.health <= 0 ? " - KO" : ""}`;
    fillEl.style.width = pct + "%";
    fillEl.style.background = pct > 50 ? "#6bcf6b" : pct > 20 ? "#e0b34d" : "#e06060";
  }

  function renderHand(state, myPlayer) {
    const row = document.getElementById("hand-row");
    row.innerHTML = "";
    const isMyTurn = state.activePlayerId === state.you;
    (myPlayer.hand || []).forEach(cardInst => {
      const card = cardById(cardInst.cardId);
      const div = document.createElement("div");
      const affordable = state.options.sandbox || myPlayer.mana >= card.cost;
      const isSpell = card.type === "spell";
      div.className = "hand-card" + (isSpell ? " spell" : "") +
        (selectedHand && selectedHand.instanceId === cardInst.instanceId ? " selected" : "") +
        (!affordable ? " unaffordable" : "");
      const unitAbilitiesTag = (!isSpell && card.abilities && card.abilities.length > 0)
        ? card.abilities.map(aid => {
            const ab = ABILITIES[aid];
            return ab ? `<span class="ability-mini-tag" data-tooltip="${escapeAttr(abilityTooltipHtml(ab))}">${ab.name}</span>` : "";
          }).join(" ")
        : "";
      div.innerHTML = isSpell ? `
        <div class="cost">${card.cost} mana</div>
        <div class="name">${card.name} <span class="spell-tag">SORT</span></div>
        <div class="stats">${card.description}</div>
      ` : `
        <div class="cost">${card.cost} mana</div>
        <div class="name">${card.name}</div>
        <div class="stats">ATQ ${card.attack} / PV ${card.health}</div>
        <div class="stats">MOV ${card.movement} / PORTEE ${card.range}</div>
        ${unitAbilitiesTag ? `<div class="stats">${unitAbilitiesTag}</div>` : ""}
      `;
      div.addEventListener("click", () => {
        if (!isMyTurn) return;
        showCardDetail(card, false);

        // Ravitaillement (aucune cible) : effet immediat au clic, le mana
        // n'est consomme que si le serveur valide effectivement l'action.
        if (isSpell && card.targetType === "none") {
          socket.emit("castSpell", { instanceId: cardInst.instanceId, targetId: null });
          return;
        }

        if (selectedHand && selectedHand.instanceId === cardInst.instanceId) {
          clearSelection();
        } else {
          clearSelection();
          selectedHand = { instanceId: cardInst.instanceId, card };
        }
        renderBoard(lastState);
        renderHand(lastState, myPlayer);
      });
      row.appendChild(div);
    });
  }

  function renderBoard(state) {
    const board = document.getElementById("board");
    board.innerHTML = "";
    // cols/rows sont les dimensions du rectangle "offset" (colonnes/lignes
    // visuelles) envoyees par le serveur -- voir game/hexGrid.js.
    const cols = state.board.cols, rows = state.board.rows;

    let maxX = 0, maxY = 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const p = hexPixel(col, row);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
    }
    const hexW = HEX_SIZE * 2, hexH = HEX_SIZE * Math.sqrt(3);
    const boardW = maxX + hexW, boardH = maxY + hexH;
    // #board garde TOUJOURS ses dimensions naturelles (non tournees) : les
    // hexagones a l'interieur sont positionnes dans ce repere, la rotation
    // CSS ne fait que le tourner visuellement autour de son centre.
    board.style.width = boardW + "px";
    board.style.height = boardH + "px";

    const me = state.you;
    const mySide = state.players[me].side;
    const rotationDeg = SEAT_ROTATION[mySide] || 0;
    board.className = "rot-" + rotationDeg;

    // BUG DE ZOOM (sieges gauche/droite) : #board-wrapper reservait l'espace
    // des dimensions NON tournees du plateau. A 90/270 dega, largeur et
    // hauteur visuelles sont inversees par la rotation CSS -- le plateau
    // debordait donc du conteneur (ou laissait un vide), ce qui donnait
    // l'impression d'un plateau "zoome"/decale pour ces joueurs. Le wrapper
    // doit reserver l'espace du plateau tel qu'il apparait APRES rotation.
    const wrapper = document.getElementById("board-wrapper");
    const swapped = rotationDeg === 90 || rotationDeg === 270;
    wrapper.style.width = (swapped ? boardH : boardW) + "px";
    wrapper.style.height = (swapped ? boardW : boardH) + "px";

    const myZoneKeys = new Set(deployZoneCells(mySide, cols, rows).map(c => `${c.q},${c.r}`));
    const enemyZoneKeys = new Set();
    (state.board.seats || []).forEach(side => {
      if (side === mySide) return;
      deployZoneCells(side, cols, rows).forEach(c => enemyZoneKeys.add(`${c.q},${c.r}`));
    });

    // Position d'AFFICHAGE : normalement celle de l'etat serveur, mais
    // pendant une animation de deplacement (voir socket.on("unitMoved")) on
    // affiche l'unite a sa case COURANTE dans le trajet, jamais teleportee.
    const unitsByCell = {};
    Object.values(state.units).forEach(u => {
      if (u.health <= 0) return;
      const anim = animations[u.id];
      const pos = anim || u;
      unitsByCell[`${pos.q},${pos.r}`] = u;
    });

    const isMyTurn = state.activePlayerId === me;
    const selectedUnit = selectedUnitId ? state.units[selectedUnitId] : null;

    // Cibles d'attaque valides pour l'unite selectionnee (uniquement pendant
    // mon tour : une unite peut desormais etre selectionnee hors tour pour
    // simple consultation, sans proposer d'action impossible).
    let attackTargets = [];
    if (isMyTurn && selectedUnit && !selectedUnit.hasAttacked && selectedUnit.ownerId === me) {
      attackTargets = Object.values(state.units).filter(u =>
        u.health > 0 && u.ownerId !== me && cubeDistance(selectedUnit, u) <= selectedUnit.range && cubeDistance(selectedUnit, u) > 0
      );
    }

    // Cibles valides pour une competence armee. Pour la Charge, la portee
    // affichee est indicative (deplacement + portee d'attaque combines) :
    // le serveur reste seul juge de la validite reelle (ligne de vue,
    // chemin atteignable, Provocation).
    let abilityTargets = [];
    if (armedAbility && selectedUnit) {
      const ab = armedAbility.ability;
      const effectiveRange = ab.isCharge ? (selectedUnit.effectiveMovement != null ? selectedUnit.effectiveMovement : selectedUnit.movement) + ab.range : ab.range;
      abilityTargets = Object.values(state.units).filter(u => {
        if (u.health <= 0) return false;
        if (ab.targetType === "ally" && u.ownerId !== me) return false;
        if (ab.targetType === "enemy" && u.ownerId === me) return false;
        return cubeDistance(selectedUnit, u) <= effectiveRange;
      });
    }

    // Cibles valides pour un sort selectionne dans la main (Soin/Frappe).
    // Contrairement aux competences d'unite, un sort n'a pas de portee
    // limitee : toute unite alliee/ennemie sur le plateau est ciblable.
    let spellTargets = [];
    if (selectedHand && selectedHand.card.type === "spell" && selectedHand.card.targetType !== "none") {
      const spell = selectedHand.card;
      spellTargets = Object.values(state.units).filter(u => {
        if (u.health <= 0) return false;
        if (spell.targetType === "ally") return u.ownerId === me;
        if (spell.targetType === "enemy") return u.ownerId !== me;
        return false;
      });
    }

    // Jet d'eau (et tout futur sort "cell") : n'importe quelle case du
    // plateau est une cible valide, occupee ou non -- contrairement aux
    // sorts/competences cibles sur unite.
    const cellSpellArmed = isMyTurn && selectedHand && selectedHand.card.type === "spell" &&
      selectedHand.card.targetType === "cell";

    // Cases boueuses (Jet d'eau) : permanentes, affichees quel que soit
    // l'etat de selection courant.
    const mudKeys = new Set(state.mudCells || []);

    // Pieges : le serveur ne nous envoie JAMAIS ceux d'un adversaire (voir
    // gameState.js#serializeForPlayer), donc state.traps ne contient ici
    // que les notres -- aucun filtrage supplementaire necessaire cote client.
    const trapKeys = new Set((state.traps || []).map(t => `${t.q},${t.r}`));

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const { q, r } = offsetToAxial(col, row);
        const key = `${q},${r}`;
        const p = hexPixel(col, row);
        const div = document.createElement("div");
        div.className = "hex";
        div.style.left = p.x + "px";
        div.style.top = p.y + "px";
        div.style.width = hexW + "px";
        div.style.height = hexH + "px";

        const isMyZone = myZoneKeys.has(key);
        if (isMyZone) div.classList.add("deploy-own");
        else if (enemyZoneKeys.has(key)) div.classList.add("deploy-enemy");

        if (mudKeys.has(key)) div.classList.add("mud");
        if (trapKeys.has(key)) {
          div.classList.add("trap");
          const marker = document.createElement("div");
          marker.className = "trap-marker";
          // Caractere large-support (evite les emoji recents type mousetrap,
          // absents de certaines polices systeme et rendus en "tofu").
          marker.textContent = "!";
          marker.setAttribute("data-tooltip", "Ton piege (invisible pour l'adversaire).");
          div.appendChild(marker);
        }

        const isReachable = reachableCells.some(c => c.q === q && c.r === r);
        if (isReachable) div.classList.add("reachable");
        if (cellSpellArmed) div.classList.add("cell-target");

        const unit = unitsByCell[key];
        if (unit) {
          const isAttackTarget = attackTargets.some(u => u.id === unit.id);
          const isAbilityTarget = abilityTargets.some(u => u.id === unit.id);
          const isSpellTarget = spellTargets.some(u => u.id === unit.id);
          if (isAttackTarget || isAbilityTarget || isSpellTarget) div.classList.add("attackable");

          const token = document.createElement("div");
          const isMine = unit.ownerId === me;
          token.className = "unit-token " + (isMine ? "mine" : "theirs") + (unit.isChampion ? " champion" : "") +
            (isMine && unit.invisible ? " invisible-mine" : "");
          token.innerHTML = `<div>${unit.name}${isMine && unit.invisible ? " 👻" : ""}</div><div class="u-hp">${unit.health}/${unit.maxHealth}</div>`;
          div.appendChild(token);

          if (unit.id === selectedUnitId || unit.id === inspectedEnemyId) div.classList.add("selected");

          div.addEventListener("click", () => onUnitClick(state, unit));
        } else if (cellSpellArmed) {
          div.addEventListener("click", () => onCellSpellClick(state, q, r));
        } else if (isReachable) {
          div.addEventListener("click", () => onEmptyCellClick(state, q, r));
        } else if (selectedHand && selectedHand.card.type !== "spell" && isMyZone && isMyTurn) {
          div.addEventListener("click", () => onDeployClick(q, r));
        }

        board.appendChild(div);
      }
    }

    renderInfoPanel(state, selectedUnit);
    renderEnemyPanel(state);
  }

  function onUnitClick(state, unit) {
    const me = state.you;
    const isMyTurn = state.activePlayerId === me;

    if (selectedHand && selectedHand.card.type === "spell") {
      const spell = selectedHand.card;
      // Sort cible sur case (Jet d'eau) : une case occupee reste une cible
      // valide (l'unite dessus subit la boue immediatement), on caste donc
      // sur la case sous l'unite plutot que de traiter l'unite comme cible.
      if (spell.targetType === "cell") {
        socket.emit("castSpell", { instanceId: selectedHand.instanceId, targetId: null, targetCell: { q: unit.q, r: unit.r } });
        clearSelection();
        renderBoard(lastState);
        return;
      }
      const validTarget =
        (spell.targetType === "ally" && unit.ownerId === me) ||
        (spell.targetType === "enemy" && unit.ownerId !== me);
      if (validTarget) {
        socket.emit("castSpell", { instanceId: selectedHand.instanceId, targetId: unit.id });
        clearSelection();
        renderBoard(lastState);
      }
      return; // un sort arme ne retombe jamais sur la selection/attaque d'unite
    }

    if (armedAbility && selectedUnitId) {
      socket.emit("useAbility", { casterId: selectedUnitId, abilityId: armedAbility.abilityId, targetId: unit.id });
      clearSelection();
      return;
    }

    if (selectedUnitId) {
      const selectedUnit = state.units[selectedUnitId];
      const dist = cubeDistance(selectedUnit, unit);
      const canAttack = isMyTurn && selectedUnit.ownerId === me && !selectedUnit.hasAttacked &&
        unit.ownerId !== me && dist <= selectedUnit.range && dist > 0;
      if (canAttack) {
        socket.emit("attackUnit", { attackerId: selectedUnitId, targetId: unit.id });
        clearSelection();
        return;
      }
    }

    if (unit.id === selectedUnitId || unit.id === inspectedEnemyId) { clearSelection(); renderBoard(lastState); return; }

    clearSelection();
    if (unit.ownerId === me) {
      // Mes unites : panneau bleu (a gauche). Le deplacement n'est propose
      // que si c'est mon tour, mais je peux toujours consulter ses infos.
      selectedUnitId = unit.id;
      if (isMyTurn && unit.health > 0) {
        socket.emit("requestReachable", { unitId: unit.id }, res => {
          reachableCells = (res && res.ok && !unit.hasMoved) ? res.cells : [];
          renderBoard(lastState);
        });
      }
    } else {
      // Unite adverse (quel que soit l'adversaire, jusqu'a 3 en 4 joueurs) :
      // simple consultation dans le panneau rouge (a droite).
      inspectedEnemyId = unit.id;
    }
    renderBoard(lastState);
  }

  function onEmptyCellClick(state, q, r) {
    if (!selectedUnitId) return;
    socket.emit("moveUnit", { unitId: selectedUnitId, q, r });
    clearSelection();
  }

  function onCellSpellClick(state, q, r) {
    if (!selectedHand || selectedHand.card.type !== "spell" || selectedHand.card.targetType !== "cell") return;
    socket.emit("castSpell", { instanceId: selectedHand.instanceId, targetId: null, targetCell: { q, r } });
    clearSelection();
    renderBoard(lastState);
  }

  function onDeployClick(q, r) {
    if (!selectedHand) return;
    socket.emit("playCard", { instanceId: selectedHand.instanceId, q, r });
    clearSelection();
  }

  // Affiche le deplacement reel de l'unite (boue comprise, voir
  // gameState.js#effectiveMovement) avec un indice visuel quand elle est
  // ralentie par la boue.
  function movementLabel(unit) {
    const eff = unit.effectiveMovement != null ? unit.effectiveMovement : unit.movement;
    return eff !== unit.movement ? `${eff} (boue, -1)` : `${eff}`;
  }

  function renderInfoPanel(state, selectedUnit) {
    const panel = document.getElementById("panel-mine-content");
    const me = state.you;

    if (selectedHand) {
      const c = selectedHand.card;
      if (c.type === "spell") {
        const hint = c.targetType === "ally" ? "Clique une unite alliee (surlignee) pour cibler ce sort."
          : c.targetType === "enemy" ? "Clique une unite ennemie (surlignee) pour cibler ce sort."
          : c.targetType === "cell" ? "Clique n'importe quelle case du plateau pour cibler ce sort."
          : "Effet applique immediatement.";
        panel.innerHTML = `
          <div class="info-title">${c.name} (${c.cost} mana) <span class="spell-tag">SORT</span></div>
          <p>${c.description}</p>
          <p class="hint">${hint}</p>
        `;
        return;
      }
      panel.innerHTML = `
        <div class="info-title">${c.name} (${c.cost} mana)</div>
        <div class="info-stats">
          <span>Attaque: ${c.attack}</span><span>PV: ${c.health}</span>
          <span>Deplacement: ${c.movement}</span><span>Portee: ${c.range}</span>
        </div>
        <p>${c.description}</p>
        <p class="hint">Clique une case verte de ta zone de deploiement pour l'invoquer.</p>
      `;
      return;
    }

    if (!selectedUnit) {
      panel.innerHTML = `<p class="hint">Selectionne une unite ou une carte pour voir ses informations.</p>`;
      return;
    }

    // selectedUnit est toujours une de MES unites (les unites adverses sont
    // gerees a part par renderEnemyPanel/inspectedEnemyId).
    const isMyTurn = state.activePlayerId === me;
    const abilitiesHtml = (selectedUnit.abilities || []).map(aid => {
      const ab = ABILITIES[aid];
      if (!ab) return "";
      const tooltip = escapeAttr(abilityTooltipHtml(ab));
      if (ab.passive) {
        // Passive (ex: Provocation) : jamais activable, simple etiquette informative.
        return `<span class="ability-btn passive-tag" data-tooltip="${tooltip}">${ab.name} (passif)</span>`;
      }
      const armed = armedAbility && armedAbility.abilityId === aid;
      const remaining = usesRemainingLabel(selectedUnit.abilityUses, aid, ab.uses);
      return `<button class="ability-btn${armed ? " armed" : ""}" data-ability="${aid}" data-tooltip="${tooltip}">${ab.name} (${ab.cost} mana)${remaining}</button>`;
    }).join("");

    panel.innerHTML = `
      <div class="info-title">${selectedUnit.name}${selectedUnit.isChampion ? " - Champion" : ""}</div>
      <div class="info-stats">
        <span>PV: ${selectedUnit.health}/${selectedUnit.maxHealth}</span>
        <span>Attaque: ${selectedUnit.attack}</span>
        <span>Deplacement: ${movementLabel(selectedUnit)}</span>
        <span>Portee: ${selectedUnit.range}</span>
      </div>
      ${selectedUnit.passive ? `<p><b>Passif - ${selectedUnit.passive.name}:</b> ${selectedUnit.passive.description}</p>` : ""}
      <div>${abilitiesHtml}</div>
      ${isMyTurn ? "" : `<p class="hint">Ce n'est pas ton tour.</p>`}
    `;

    if (isMyTurn) {
      panel.querySelectorAll(".ability-btn[data-ability]").forEach(btn => {
        btn.addEventListener("click", () => {
          const abilityId = btn.dataset.ability;
          const ability = ABILITIES[abilityId];
          const player = state.players[me];
          if (!state.options.sandbox && player.mana < ability.cost) return;
          if (ability.targetType === "self") {
            socket.emit("useAbility", { casterId: selectedUnit.id, abilityId, targetId: selectedUnit.id });
            clearSelection();
            renderBoard(lastState);
          } else {
            armedAbility = { abilityId, ability };
            renderBoard(lastState);
          }
        });
      });
    }
  }

  // Libelle "(reste 1/2)" a cote d'une competence/sort limite en utilisations.
  function usesRemainingLabel(store, key, usesLimit) {
    if (!usesLimit) return "";
    const c = (store && store[key]) || { total: 0, thisTurn: 0 };
    const bits = [];
    if (usesLimit.total != null) bits.push(`${usesLimit.total - c.total}/${usesLimit.total} au total`);
    if (usesLimit.perTurn != null) bits.push(`${usesLimit.perTurn - c.thisTurn}/${usesLimit.perTurn} ce tour`);
    return ` [${bits.join(", ")}]`;
  }

  // Panneau rouge (a droite) : simple consultation d'une unite adverse,
  // aucune action possible (pas de boutons de competence).
  function renderEnemyPanel(state) {
    const panel = document.getElementById("panel-theirs-content");
    if (!panel) return;
    const unit = inspectedEnemyId ? state.units[inspectedEnemyId] : null;
    if (!unit) {
      panel.innerHTML = `<p class="hint">Clique une unite adverse pour voir ses informations.</p>`;
      return;
    }
    const abilitiesHtml = (unit.abilities || []).map(aid => {
      const ab = ABILITIES[aid];
      if (!ab) return "";
      const costLabel = ab.passive ? "passif" : `cout ${ab.cost}, portee ${ab.range}`;
      return `<li data-tooltip="${escapeAttr(abilityTooltipHtml(ab))}"><b>${ab.name}</b> (${costLabel}) - ${ab.description}</li>`;
    }).join("");
    panel.innerHTML = `
      <div class="info-title">${unit.name}${unit.isChampion ? " - Champion" : ""}</div>
      <div class="info-stats">
        <span>PV: ${unit.health}/${unit.maxHealth}</span>
        <span>Attaque: ${unit.attack}</span>
        <span>Deplacement: ${movementLabel(unit)}</span>
        <span>Portee: ${unit.range}</span>
      </div>
      ${unit.passive ? `<p><b>Passif - ${unit.passive.name}:</b> ${unit.passive.description}</p>` : ""}
      ${abilitiesHtml ? `<ul>${abilitiesHtml}</ul>` : ""}
    `;
  }

  // ----------------------------------------------------------------
  // Abandon (double confirmation)
  // ----------------------------------------------------------------
  const forfeitOverlay = document.getElementById("forfeit-overlay");
  document.getElementById("btn-forfeit").addEventListener("click", () => {
    document.getElementById("forfeit-step-1").style.display = "";
    document.getElementById("forfeit-step-2").style.display = "none";
    forfeitOverlay.classList.add("active");
  });
  document.getElementById("btn-forfeit-cancel-1").addEventListener("click", () => forfeitOverlay.classList.remove("active"));
  document.getElementById("btn-forfeit-cancel-2").addEventListener("click", () => forfeitOverlay.classList.remove("active"));
  document.getElementById("btn-forfeit-next").addEventListener("click", () => {
    document.getElementById("forfeit-step-1").style.display = "none";
    document.getElementById("forfeit-step-2").style.display = "";
  });
  document.getElementById("btn-forfeit-confirm").addEventListener("click", () => {
    socket.emit("forfeit");
    forfeitOverlay.classList.remove("active");
  });
})();
