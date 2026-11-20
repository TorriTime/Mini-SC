/* ============================================================
 * Poses et animations des stickmen.
 *
 * Une POSE est un jeu d'angles (radians) :
 *   torso : inclinaison du buste (+ = vers l'avant)
 *   head  : inclinaison de la tête
 *   laU/laL, raU/raL : bras gauche (arrière) / droit (avant), segment haut / bas
 *   llU/llL, rlU/rlL : jambes gauche (arrière) / droite (avant)
 *     pour les membres : 0 = vers le bas, +π/2 = vers l'avant, π = vers le haut
 *   rx, ry : décalage du bassin (px) ; rr : rotation du corps autour du bassin
 *
 * Une ANIMATION est une suite d'étapes { p: pose|nom|'$base', d: durée ms, hit: true }.
 * `hit` marque l'instant d'impact (la promesse `hit` se résout à ce moment).
 * `$base` = retour à la pose de base courante (idle, en l'air, au sol...).
 *
 * Ajouter une animation : SC.anims.register({ id, steps }).
 * ============================================================ */
(function (root) {
  'use strict';
  const SC = root.SC;

  SC.POSE_KEYS = ['torso', 'head', 'laU', 'laL', 'raU', 'raL', 'llU', 'llL', 'rlU', 'rlL', 'rx', 'ry', 'rr'];
  SC.poses = new SC.Registry('pose');
  SC.anims = new SC.Registry('animation');

  const IDLE = {
    torso: 0.08, head: 0,
    laU: -0.45, laL: 0.35, raU: 0.55, raL: 1.35,
    llU: -0.35, llL: -0.15, rlU: 0.45, rlL: 0.1,
    rx: 0, ry: 0, rr: 0,
  };
  SC.poses.register({ id: 'idle', pose: IDLE });
  const P = (id, o) => SC.poses.register({ id, pose: Object.assign({}, IDLE, o) });
  SC.poseOf = p => (typeof p === 'string' ? SC.poses.get(p).pose : Object.assign({}, IDLE, p));

  // --- poses d'attaque ---
  P('crouch',        { torso: 0.4, ry: 9, llU: 0.9, llL: -0.1, rlU: 1.0, rlL: -0.2, raU: -0.6, raL: 0.2, laU: -0.5, laL: 0.4 });
  P('windupPunch',   { torso: -0.2, raU: -0.8, raL: 0.9, laU: 1.2, laL: 1.5, rlU: -0.15, rlL: -0.5, llU: 0.55, llL: 0.15, rx: -8, ry: 3 });
  P('punchHit',      { torso: 0.5, head: 0.1, raU: 1.5, raL: 1.5, laU: -0.8, laL: 0.2, rlU: 1.0, rlL: 0.35, llU: -0.7, llL: -1.1, rx: 20 });
  P('kickWind',      { torso: -0.3, raU: 0.7, raL: 1.4, laU: -0.7, laL: 0.3, rlU: 1.1, rlL: -0.4, llU: -0.1, llL: -0.1, rx: -6 });
  P('kickHit',       { torso: -0.5, raU: -0.9, raL: -0.4, laU: 1.1, laL: 0.9, rlU: 1.45, rlL: 1.5, llU: -0.1, llL: -0.15, rx: 16, ry: -4 });
  P('slashWind',     { torso: -0.35, raU: 2.6, raL: 2.9, laU: 0.6, laL: 1.2, rlU: -0.1, rlL: -0.5, llU: 0.55, llL: 0.1, rx: -8 });
  P('slashHit',      { torso: 0.6, raU: 1.2, raL: 1.0, laU: -0.9, laL: -0.2, rlU: 1.0, rlL: 0.4, llU: -0.7, llL: -1.0, rx: 22 });
  P('slash2Wind',    { torso: 0.25, raU: -0.6, raL: -0.2, laU: 1.0, laL: 1.3, rlU: 0.7, rlL: 0.2, llU: -0.6, llL: -0.8, rx: -4, ry: 4 });
  P('slash2Hit',     { torso: -0.1, raU: 2.4, raL: 2.0, laU: -0.9, laL: -0.3, rlU: 0.8, rlL: 0.2, llU: -0.5, llL: -0.9, rx: 14, ry: -4 });
  P('uppercutWind',  { torso: 0.5, ry: 9, raU: -0.6, raL: 0.1, laU: 0.9, laL: 1.4, rlU: 1.0, rlL: -0.2, llU: 0.7, llL: -0.4 });
  P('uppercutHit',   { torso: -0.05, ry: -26, raU: 2.9, raL: 3.1, laU: -0.9, laL: -0.4, rlU: 0.6, rlL: -0.4, llU: 0.1, llL: -1.0, rx: 14 });
  P('slamUp',        { torso: -0.35, ry: -20, raU: 2.9, raL: 3.1, laU: 2.8, laL: 3.0, rlU: 0.3, rlL: -0.5, llU: 0.2, llL: -0.5 });
  P('slamHit',       { torso: 0.85, ry: 4, raU: 1.05, raL: 0.85, laU: 1.1, laL: 0.9, rlU: 0.9, rlL: 0.3, llU: -0.6, llL: -1.0, rx: 16 });
  P('castUp',        { torso: -0.1, raU: 2.3, raL: 2.7, laU: 1.9, laL: 2.3, rlU: 0.5, rlL: 0.1, llU: -0.5, llL: -0.2 });
  P('castHold',      { torso: 0.15, raU: 1.55, raL: 1.55, laU: 1.4, laL: 1.5, rlU: 0.55, rlL: 0.15, llU: -0.5, llL: -0.3, rx: 6 });
  P('shootAim',      { torso: 0.1, raU: 1.55, raL: 1.57, laU: -1.35, laL: 1.45, rlU: 0.55, rlL: 0.15, llU: -0.5, llL: -0.3, rx: 4 });
  P('shootRelease',  { torso: 0.05, raU: 1.55, raL: 1.57, laU: -1.0, laL: 0.3, rlU: 0.55, rlL: 0.15, llU: -0.5, llL: -0.3, rx: 2 });
  P('guard',         { torso: 0.15, head: 0.1, raU: 1.0, raL: 2.6, laU: 0.8, laL: 2.7, rlU: 0.5, rlL: 0.1, llU: -0.6, llL: -0.2, rx: -4, ry: 3 });
  P('victory',       { torso: -0.05, raU: 2.9, raL: 3.0, laU: 2.7, laL: 2.9, rlU: 0.3, rlL: 0.1, llU: -0.3, llL: -0.2 });

  // --- poses d'états (voir statevisuals.js) ---
  P('air',  { torso: -0.5, head: -0.3, raU: 2.4, raL: 2.0, laU: 1.5, laL: 0.9, rlU: 0.9, rlL: -0.3, llU: 0.1, llL: -0.9, rr: -0.4, ry: -105, rx: -10 });
  P('low',  { torso: -0.1, head: -0.2, raU: 2.2, raL: 2.6, laU: 1.5, laL: 2.0, rlU: 0.7, rlL: 0.1, llU: 0.4, llL: 0.0, rr: -1.3, ry: -46, rx: -12 });
  P('push', { torso: -0.35, head: -0.1, raU: 1.2, raL: 2.2, laU: 0.9, laL: 2.3, rlU: 0.8, rlL: 0.2, llU: -0.7, llL: -0.9, rx: -10 });
  P('down', { torso: 0, head: 0.1, raU: 0.5, raL: 0.2, laU: -0.3, laL: -0.5, rlU: 0.2, rlL: 0.1, llU: -0.2, llL: 0.0, rr: -1.5, ry: 36, rx: -22 });

  // --- animations ---
  const A = (id, steps) => SC.anims.register({ id, steps });
  A('punch',    [{ p: 'windupPunch', d: 130 }, { p: 'punchHit', d: 75, hit: true, ease: 'inQuad' }, { p: 'punchHit', d: 90 }, { p: '$base', d: 170 }]);
  A('kick',     [{ p: 'kickWind', d: 140 }, { p: 'kickHit', d: 80, hit: true, ease: 'inQuad' }, { p: 'kickHit', d: 90 }, { p: '$base', d: 180 }]);
  A('slash',    [{ p: 'slashWind', d: 150 }, { p: 'slashHit', d: 70, hit: true, ease: 'inQuad' }, { p: 'slashHit', d: 80 }, { p: '$base', d: 170 }]);
  A('slash2',   [{ p: 'slash2Wind', d: 110 }, { p: 'slash2Hit', d: 70, hit: true, ease: 'inQuad' }, { p: 'slash2Hit', d: 80 }, { p: '$base', d: 170 }]);
  A('uppercut', [{ p: 'uppercutWind', d: 170 }, { p: 'uppercutHit', d: 90, hit: true, ease: 'outQuad' }, { p: 'uppercutHit', d: 160 }, { p: '$base', d: 230 }]);
  A('slam',     [{ p: 'slamUp', d: 200 }, { p: 'slamHit', d: 80, hit: true, ease: 'inQuad' }, { p: 'slamHit', d: 120 }, { p: '$base', d: 200 }]);
  A('cast',     [{ p: 'castUp', d: 230 }, { p: 'castHold', d: 90, hit: true }, { p: 'castHold', d: 150 }, { p: '$base', d: 200 }]);
  A('shoot',    [{ p: 'shootAim', d: 200 }, { p: 'shootAim', d: 90 }, { p: 'shootRelease', d: 50, hit: true }, { p: 'shootRelease', d: 120 }, { p: '$base', d: 180 }]);
  A('guard',    [{ p: 'guard', d: 120 }, { p: 'guard', d: 380 }, { p: '$base', d: 160 }]);
  A('getup',    [{ p: 'crouch', d: 230 }, { p: '$base', d: 200 }]);
})(typeof window !== 'undefined' ? window : globalThis);
