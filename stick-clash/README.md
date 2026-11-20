# Stick Clash

Petit jeu de combat d'équipes au tour par tour, inspiré du système de combat de Naruto Online (version simplifiée), avec des bonshommes bâtons animés. Projet personnel.

**Lancer le jeu : ouvrir `index.html` dans un navigateur** (aucune installation, aucun serveur, aucun build).

```bash
node tests/run.js          # tests du moteur + simulation de 300 combats (sans navigateur)
node tools/build-single.js # produit dist/stick-clash.html (jeu en un seul fichier)
```

## Règles

- **2 équipes de 4**. Les personnages jouent à tour de rôle, par ordre de **vitesse**.
- Chaque personnage a une **attaque normale**, une **technique spéciale** (coût en chakra + temps de recharge), une ou plusieurs **poursuites**, et un **passif**. Tout le monde peut aussi **se concentrer** (passer son tour : +25 chakra et garde).
- **Chakra** : +20 au début de chaque tour, +10 avec une attaque normale, +5 quand on est touché. Une technique coûte 30 à 50 et se recharge en 2 à 4 tours.
- Une attaque peut infliger un **état** : `Projection haute`, `Projection basse`, `Repoussement`, `Chute`.
- **Poursuites** : après une action, chaque allié (par ordre d'emplacement) dont une poursuite réagit à l'état d'un ennemi tente de frapper, avec **50 % de chance** (`rules.pursuitChance`, ou `chance` sur la poursuite). Un échec écarte ce personnage pour le reste de la chaîne. Elle consomme l'état et peut en infliger un nouveau, ce qui déclenche la poursuite suivante : **chaîne de combo**.
  - un personnage ne poursuit qu'**une fois par chaîne** ; l'auteur de l'action initiale ne poursuit pas son propre coup ;
  - les dégâts diminuent légèrement au fil de la chaîne (`rules.comboScaling`) ; 8 actions maximum ;
  - les états retombent à la fin de la chaîne.
- **Menu** : glissez les personnages du roster vers un emplacement (remplace ou échange), entre emplacements (échange), vers l'autre équipe (copie), ou hors du plateau (retrait). Le panneau d'analyse liste tous les enchaînements possibles de l'équipe active, signale les trous (états que personne ne poursuit) et propose la meilleure formation.
- **Formation** : l'ordre des 4 emplacements compte. L'emplacement 1 poursuit en premier mais subit +10 % de dégâts, l'emplacement 4 subit −10 %. Deux personnages qui réagissent au même état : celui qui est devant poursuit.

### Contrôles (combat)

| | |
|---|---|
| Clic sur une technique, puis clic sur un ennemi | action ciblée (l'aperçu indique les poursuites attendues) |
| `1` `2` `3` | choisir l'action · `Échap` annule le ciblage |
| `A` | Auto : l'IA joue votre équipe · `V` : vitesse ×0,5 / ×1 / ×2 / ×4 |

Le mode **Spectateur** (menu) fait jouer l'IA des deux côtés : pratique pour observer les combos et tester des compositions.

## Architecture

```
index.html                 liste des scripts (l'ordre de chargement est ici, et lu par les tests)
js/core/util.js            registres, aléatoire à seed, easing
js/data/                   ► LE CONTENU
  config.js                règles globales + emplacements de l'arène
  elements.js states.js buffs.js
  characters/*.js          un fichier = un personnage
js/engine/                 ► LES RÈGLES (aucun accès au DOM)
  schema.js                validation des personnages (erreurs explicites)
  unit.js battle.js ai.js
js/render/                 ► LA MISE EN SCÈNE
  anims.js stickman.js     poses, animations, dessin du squelette, accessoires
  fx.js vfxlib.js          particules + effets nommés par technique
  statevisuals.js          aspect visuel de chaque état
  stage.js director.js     canvas/caméra/HUD + traduction événements → animations
js/ui/                     menu, interface de combat, descriptions auto-générées
tests/                     tests Node du moteur
```

Le principe clé : **le moteur ne dessine rien**. Il résout les règles et émet des événements (`attack:begin`, `hit`, `death`, `chain:end`…) en les attendant. Le *réalisateur* (`director.js`) les joue en animation, ce qui cadence le combat. Sans réalisateur, un combat se résout instantanément, c'est ce qu'utilisent les tests et les simulations d'équilibrage.

## Ajouter du contenu

### Un personnage
Créer `js/data/characters/mon-perso.js` et ajouter une ligne `<script>` dans `index.html`. Rien d'autre : le menu, la fiche, les synergies affichées et l'IA le prennent en compte.

```js
SC.defineCharacter({
  id: 'mon-perso', name: 'Nom', title: 'Titre', role: 'Rôle', element: 'fire',
  look:  { color: '#ff7a45', accent: '#ffd36b', parts: ['hair-spiky', 'sword'] },
  stats: { hp: 900, atk: 100, def: 50, spd: 90, crit: 0.1 },
  normal:  { id: 'mp-n', name: 'Coup', anim: 'punch', vfx: { impact: 'punch' },
             hits: [{ power: 1.0, state: 'PUSH', stateChance: 0.4 }] },
  special: { id: 'mp-s', name: 'Technique', cost: 35, cooldown: 3, target: 'enemies', move: 'none',
             anim: 'cast', vfx: { cast: 'flame-aura', impact: 'blast' },
             hits: [{ power: 0.8, state: 'HIGH', buffs: [{ id: 'burn', duration: 2, chance: 0.5 }] }] },
  pursuits: [{ id: 'mp-p', name: 'Suite', triggers: ['HIGH'], anim: 'slam',
               hits: [{ power: 0.9, state: 'DOWN' }] }],
  passives: [{ id: 'mp-x', name: 'Passif', desc: '+10 % dégâts sur les poursuites',
               damageDealt: (unit, ctx) => (ctx.pursuit ? 1.1 : 1) }],
});
```

Les champs d'une capacité (cible `enemy|enemies|ally|allies|self`, déplacement `melee|ranged|none`, `hits`, etc.) sont documentés en tête de `js/engine/schema.js`. Les crochets de passifs disponibles : `stats`, `damageDealt`, `damageTaken`, `onBattleStart`, `onTurnStart`, `onKill`.

### Les autres briques

| Je veux ajouter… | Où |
|---|---|
| un **état** de contrôle | `js/data/states.js` + son visuel dans `js/render/statevisuals.js` |
| un **effet durable** (poison, bouclier…) | `js/data/buffs.js` (stats, dégâts, ou `onTurnStart`) |
| un **élément** (couleurs des effets) | `js/data/elements.js` |
| un **effet visuel** de technique | `SC.vfx.cast / travel / impact['nom']` dans `js/render/vfxlib.js` |
| une **animation** de coup | `SC.poses.register` + `SC.anims.register` dans `js/render/anims.js` |
| un **accessoire** (arme, coiffe…) | `SC.looks.register` dans `js/render/stickman.js` |
| une **règle globale** (chakra, combo, formation…) | `js/data/config.js` |

Une nouvelle mécanique (esquive, bouclier, invocation…) se branche en général dans `battle.js` (`applyHit`, `takeTurn`) et, si elle doit se voir, dans un gestionnaire de `director.js`.

## Équilibrage

`node tests/run.js 1000` simule des combats IA contre IA et affiche durée moyenne, part de chaînes ≥ 3 actions et taux de victoire par personnage. Les leviers principaux : `rules.damageScale` (durée des combats), `stateChance` des attaques normales (fréquence des combos), `rules.comboScaling`.

## Idées pour la suite

Esquive et précision · bouclier · états persistants (étourdissement) · soutiens qui déclenchent des poursuites · mode campagne / équipes prédéfinies · sauvegarde de formations nommées · ralenti « replay » du dernier combo · sons.
