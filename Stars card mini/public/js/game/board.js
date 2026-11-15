// Plateau de jeu : dessin des cases (zones, mines, boue, pieges, unites,
// surbrillances) et interpretation des clics selon la selection en cours.
// Le client propose des actions ; le serveur reste seul juge de leur validite.

import { $ } from "../dom.js";
import { socket } from "../socket.js";
import { HEX_WIDTH, HEX_HEIGHT, offsetToAxial, hexPixel, boardPixelSize, cubeDistance, cellKey, SEAT_ROTATION } from "../hex.js";
import { effectiveMovementOf } from "../views.js";
import { session, clearSelection, myId, isMyTurn, selectedSpell, refreshBoard } from "./session.js";
import { renderPanels } from "./panels.js";

const keySet = cells => new Set((cells || []).map(cellKey));
const livingUnits = state => Object.values(state.units).filter(u => u.health > 0);

function inAttackRange(attacker, target) {
  const dist = cubeDistance(attacker, target);
  return dist <= attacker.range && dist > 0;
}

/** Dimensionne #board et son conteneur, et applique la rotation du siege. */
function layoutBoard(board, state) {
  const { width, height } = boardPixelSize(state.board.cols, state.board.rows);
  // #board garde TOUJOURS ses dimensions naturelles (non tournees) : les
  // hexagones a l'interieur sont positionnes dans ce repere, la rotation
  // CSS ne fait que le tourner visuellement autour de son centre.
  board.style.width = width + "px";
  board.style.height = height + "px";
  const rotation = SEAT_ROTATION[state.players[state.you].side] || 0;
  board.className = "rot-" + rotation;

  // Le conteneur reserve l'espace du plateau tel qu'il apparait APRES
  // rotation : a 90/270 degres, largeur et hauteur visuelles sont inversees
  // (sinon le plateau deborde ou semble "zoome" pour les sieges gauche/droite).
  const swapped = rotation === 90 || rotation === 270;
  const wrapper = $("board-wrapper");
  wrapper.style.width = (swapped ? height : width) + "px";
  wrapper.style.height = (swapped ? width : height) + "px";
}

/** Decor des cases, independant de la selection : zones de deploiement,
 * mines, boue et pieges. Tout vient de l'etat serveur, rien n'est recalcule. */
function terrainOf(state) {
  const me = state.you;
  const mySide = state.players[me].side;

  const enemyZone = new Set();
  for (const [side, cells] of Object.entries(state.board.deployZones)) {
    if (side !== mySide) cells.forEach(c => enemyZone.add(cellKey(c)));
  }

  // Mines : zone, case centrale et proprietaire (couleur relative au joueur).
  const mineZoneClass = new Map(); // "q,r" -> "mine-mine" | "mine-theirs" | "mine-neutral"
  const mineCenters = new Map();   // "q,r" -> mine
  (state.mines || []).forEach(mine => {
    const cls = !mine.ownerId ? "mine-neutral" : (mine.ownerId === me ? "mine-mine" : "mine-theirs");
    mine.zone.forEach(c => {
      const key = cellKey(c);
      // Zones qui se chevauchent : une mine possedee l'emporte sur une neutre.
      if (!mineZoneClass.has(key) || cls !== "mine-neutral") mineZoneClass.set(key, cls);
    });
    mineCenters.set(cellKey(mine), mine);
  });

  return {
    ownZone: keySet(state.board.deployZones[mySide]),
    enemyZone,
    // Cases ou je peux deployer : mon camp + cases a cote de mes tours d'ouvrier.
    deployable: keySet(state.deployCells),
    advancedDeploy: keySet((state.deployCells || []).filter(c => c.advanced)),
    mineZoneClass,
    mineCenters,
    mud: new Set(state.mudCells || []),
    // Le serveur n'envoie JAMAIS les pieges d'un adversaire : ce sont les miens.
    traps: keySet(state.traps)
  };
}

/** Ids des unites a surligner comme cibles possibles de l'action en cours. */
function targetableUnitIds(state, selectedUnit) {
  const me = state.you;
  const units = livingUnits(state);
  const ids = new Set();
  const add = list => list.forEach(u => ids.add(u.id));

  // Attaque de l'unite selectionnee (uniquement pendant mon tour : une unite
  // peut etre selectionnee hors tour pour simple consultation).
  if (isMyTurn() && selectedUnit && !selectedUnit.hasAttacked && selectedUnit.ownerId === me) {
    add(units.filter(u => u.ownerId !== me && inAttackRange(selectedUnit, u)));
  }

  // Competence armee. Pour la Charge, la portee affichee est indicative
  // (deplacement + portee d'attaque combines) : le serveur verifie la ligne
  // de vue, le chemin et la Provocation.
  if (session.armedAbility && selectedUnit) {
    const ability = session.armedAbility.ability;
    const range = ability.isCharge ? effectiveMovementOf(selectedUnit) + ability.range : ability.range;
    add(units.filter(u => {
      if (ability.targetType === "ally" && u.ownerId !== me) return false;
      if (ability.targetType === "enemy" && u.ownerId === me) return false;
      return cubeDistance(selectedUnit, u) <= range;
    }));
  }

  // Sort cible sur unite : contrairement aux competences, pas de portee
  // limitee, toute unite du bon camp est ciblable.
  const spell = selectedSpell();
  if (spell && spell.targetType === "ally") add(units.filter(u => u.ownerId === me));
  if (spell && spell.targetType === "enemy") add(units.filter(u => u.ownerId !== me));

  return ids;
}

function marker(className, text, tooltip) {
  const el = document.createElement("div");
  el.className = className;
  el.textContent = text;
  el.setAttribute("data-tooltip", tooltip);
  return el;
}

function mineTooltip(mine, me) {
  if (!mine.ownerId) {
    return "Mine (neutre) - un Ouvrier doit rester un tour complet au centre pour y construire une tour.";
  }
  const who = (mine.home ? "mine de camp, " : "") + (mine.ownerId === me ? "a toi" : "a l'adversaire");
  return `Mine (${who})${mine.safe ? " - zone sure" : " - zone NON sure"}.`;
}

function unitToken(unit, me) {
  const isMine = unit.ownerId === me;
  const hidden = isMine && unit.invisible; // invisible pour l'adversaire, pas pour moi
  const token = document.createElement("div");
  token.className = "unit-token " + (isMine ? "mine" : "theirs") + (unit.isChampion ? " champion" : "") +
    (hidden ? " invisible-mine" : "");
  if (unit.isTower) token.classList.add("tower");
  const settling = unit.settlingMineId ? " (installe)" : "";
  token.innerHTML = `<div>${unit.name}${settling}${hidden ? " 👻" : ""}</div><div class="u-hp">${unit.health}/${unit.maxHealth}</div>`;
  return token;
}

export function renderBoard() {
  const state = session.state;
  const me = state.you;
  const { cols, rows } = state.board;
  const board = $("board");
  board.innerHTML = "";
  layoutBoard(board, state);

  const terrain = terrainOf(state);
  const selectedUnit = session.selectedUnitId ? state.units[session.selectedUnitId] : null;
  const targetIds = targetableUnitIds(state, selectedUnit);
  const reachable = keySet(session.reachableCells);
  const spell = selectedSpell();
  // Sort cible sur case (Jet d'eau, Piege) : n'importe quelle case du plateau
  // est une cible valide, occupee ou non.
  const cellSpellArmed = isMyTurn() && !!spell && spell.targetType === "cell";
  const unitCardSelected = !!session.selectedHand && !spell;

  // Position d'AFFICHAGE : normalement celle de l'etat serveur, mais pendant
  // une animation de deplacement on affiche l'unite a sa case COURANTE dans
  // le trajet, jamais teleportee.
  const unitsByCell = {};
  livingUnits(state).forEach(u => { unitsByCell[cellKey(session.animations[u.id] || u)] = u; });

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = offsetToAxial(col, row);
      const key = cellKey(cell);
      const pixel = hexPixel(col, row);
      const div = document.createElement("div");
      div.className = "hex";
      div.style.left = pixel.x + "px";
      div.style.top = pixel.y + "px";
      div.style.width = HEX_WIDTH + "px";
      div.style.height = HEX_HEIGHT + "px";

      if (terrain.ownZone.has(key)) div.classList.add("deploy-own");
      else if (terrain.enemyZone.has(key)) div.classList.add("deploy-enemy");
      if (terrain.advancedDeploy.has(key)) div.classList.add("deploy-advanced");
      if (terrain.mineZoneClass.has(key)) div.classList.add("mine-zone", terrain.mineZoneClass.get(key));
      const mine = terrain.mineCenters.get(key);
      if (mine) {
        div.classList.add("mine-center");
        if (mine.ownerId && !mine.safe) div.classList.add("mine-unsafe");
        div.appendChild(marker("mine-marker", "◆", mineTooltip(mine, me)));
      }
      if (terrain.mud.has(key)) div.classList.add("mud");
      if (terrain.traps.has(key)) {
        div.classList.add("trap");
        // Caractere large-support (evite les emoji recents, absents de
        // certaines polices systeme et rendus en "tofu").
        div.appendChild(marker("trap-marker", "!", "Ton piege (invisible pour l'adversaire)."));
      }
      if (reachable.has(key)) div.classList.add("reachable");
      if (cellSpellArmed) div.classList.add("cell-target");

      const unit = unitsByCell[key];
      if (unit) {
        if (targetIds.has(unit.id)) div.classList.add("attackable");
        div.appendChild(unitToken(unit, me));
        if (unit.id === session.selectedUnitId || unit.id === session.inspectedEnemyId) div.classList.add("selected");
        div.addEventListener("click", () => onUnitClick(unit));
      } else if (cellSpellArmed) {
        div.addEventListener("click", () => castSpellOnCell(cell));
      } else if (reachable.has(key)) {
        div.addEventListener("click", () => moveSelectedUnitTo(cell));
      } else if (unitCardSelected && terrain.deployable.has(key) && isMyTurn()) {
        div.addEventListener("click", () => deploySelectedCardAt(cell));
      }

      board.appendChild(div);
    }
  }

  renderPanels();
}

// ---- Clics ----

function castSpellOnCell(cell) {
  const spell = selectedSpell();
  if (!spell || spell.targetType !== "cell") return;
  socket.emit("castSpell", { instanceId: session.selectedHand.instanceId, targetId: null, targetCell: { q: cell.q, r: cell.r } });
  clearSelection();
  refreshBoard();
}

function moveSelectedUnitTo(cell) {
  if (!session.selectedUnitId) return;
  socket.emit("moveUnit", { unitId: session.selectedUnitId, q: cell.q, r: cell.r });
  clearSelection();
}

function deploySelectedCardAt(cell) {
  if (!session.selectedHand) return;
  socket.emit("playCard", { instanceId: session.selectedHand.instanceId, q: cell.q, r: cell.r });
  clearSelection();
}

/** Clic sur une unite avec un sort selectionne. Un sort arme ne retombe
 * jamais sur la selection/attaque d'unite. */
function castSpellOnUnit(spell, unit) {
  // Sort cible sur case : une case occupee reste une cible valide (l'unite
  // dessus subit l'effet), on vise donc la case sous l'unite.
  if (spell.targetType === "cell") {
    castSpellOnCell(unit);
    return;
  }
  const isMine = unit.ownerId === myId();
  const validTarget = (spell.targetType === "ally" && isMine) || (spell.targetType === "enemy" && !isMine);
  if (!validTarget) return;
  socket.emit("castSpell", { instanceId: session.selectedHand.instanceId, targetId: unit.id });
  clearSelection();
  refreshBoard();
}

function selectUnit(unit) {
  if (unit.ownerId !== myId()) {
    // Unite adverse (quel que soit l'adversaire) : simple consultation.
    session.inspectedEnemyId = unit.id;
    return;
  }
  // Mes unites : le deplacement n'est propose que si c'est mon tour, mais je
  // peux toujours consulter leurs informations.
  session.selectedUnitId = unit.id;
  if (isMyTurn() && unit.health > 0) {
    socket.emit("requestReachable", { unitId: unit.id }, res => {
      session.reachableCells = (res && res.ok && !unit.hasMoved) ? res.cells : [];
      refreshBoard();
    });
  }
}

function onUnitClick(unit) {
  const spell = selectedSpell();
  if (spell) {
    castSpellOnUnit(spell, unit);
    return;
  }

  if (session.armedAbility && session.selectedUnitId) {
    socket.emit("useAbility", { casterId: session.selectedUnitId, abilityId: session.armedAbility.abilityId, targetId: unit.id });
    clearSelection();
    return;
  }

  // (l'unite selectionnee peut avoir disparu depuis sa selection)
  const selectedUnit = session.selectedUnitId ? session.state.units[session.selectedUnitId] : null;
  if (selectedUnit) {
    const canAttack = isMyTurn() && selectedUnit.ownerId === myId() && !selectedUnit.hasAttacked &&
      unit.ownerId !== myId() && inAttackRange(selectedUnit, unit);
    if (canAttack) {
      socket.emit("attackUnit", { attackerId: selectedUnit.id, targetId: unit.id });
      clearSelection();
      return;
    }
  }

  // Second clic sur l'unite deja selectionnee/consultee : deselection.
  const wasSelected = unit.id === session.selectedUnitId || unit.id === session.inspectedEnemyId;
  clearSelection();
  if (!wasSelected) selectUnit(unit);
  refreshBoard();
}
