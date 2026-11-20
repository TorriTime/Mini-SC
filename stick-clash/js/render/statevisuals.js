/* ============================================================
 * Aspect visuel de chaque état de contrôle.
 *
 *   SC.stateVisuals[ID].enter(view, stage) : animation d'entrée dans l'état.
 *
 * L'état visuel reste jusqu'à la fin de la chaîne de combo (recover), même si
 * l'état logique a été consommé par une poursuite. Un état sans entrée ici
 * retombe sur un simple « encaisser ».
 * ============================================================ */
(function (root) {
  'use strict';
  const SC = root.SC;
  const clampX = x => SC.clamp(x, 90, SC.layout.width - 90);

  /** Recul : s'éloigne de l'adversaire (vers son propre camp). */
  function slideBack(v, dist, ms) {
    return v.moveTo(clampX(v.x - v.homeFace * dist), v.y, ms, { ease: 'outCubic', faceMove: false });
  }

  SC.stateVisuals = {
    HIGH: {
      enter(v, st) {
        v.cancelAnim();
        v.setBase('air', 0.02);
        v.hurt(1);
        slideBack(v, 28, 320);
        st.fx.ring(v.x, v.y, { r0: 8, r1: 56, color: '#ffd24a', life: 360, squash: 0.32, layer: 'ground' });
      },
    },
    LOW: {
      enter(v, st) {
        v.cancelAnim();
        v.setBase('low', 0.028);
        v.hurt(1);
        slideBack(v, 70, 300);
        st.fx.dust(v.x, v.y, { n: 6 });
      },
    },
    PUSH: {
      enter(v, st) {
        v.cancelAnim();
        v.setBase('push', 0.03);
        v.hurt(0.8);
        slideBack(v, 105, 320);
        st.fx.dust(v.x, v.y, { n: 8 });
      },
    },
    DOWN: {
      enter(v, st) {
        v.cancelAnim();
        const wasAir = v.base === 'air' || v.base === 'low';
        v.setBase('down', 0.034);
        v.hurt(1);
        if (wasAir) {
          st.wait(150).then(() => {
            st.fx.ring(v.x, v.y, { r0: 8, r1: 70, color: '#c27bff', life: 420, squash: 0.32, layer: 'ground' });
            st.fx.dust(v.x, v.y, { n: 10 });
            st.shake(4, 140);
          });
        } else st.fx.dust(v.x, v.y, { n: 6 });
      },
    },
  };

  /** Entre dans l'état (ou simple recul si l'état n'a pas d'aspect dédié). */
  SC.enterState = function (view, stateId, stage) {
    const sv = SC.stateVisuals[stateId];
    if (sv) sv.enter(view, stage); else view.hurt(1);
  };

  /** Fin de chaîne : se relève / atterrit, puis retourne à sa place. */
  SC.recoverView = async function (view, stage) {
    if (view.dead) return;
    const wasDown = view.base === 'down';
    const wasAir = view.base === 'air' || view.base === 'low';
    view.setBase('idle', 0.018);
    if (wasAir) {
      await stage.wait(170);
      stage.fx.dust(view.x, view.y, { n: 6 });
    }
    if (wasDown) { view.playAnim('getup'); await stage.wait(260); }
    const d = Math.hypot(view.homeX - view.x, view.homeY - view.y);
    if (d > 4) await view.moveTo(view.homeX, view.homeY, Math.max(160, d / 0.7), { run: true, endFace: view.homeFace });
    view.face = view.homeFace;
  };
})(typeof window !== 'undefined' ? window : globalThis);
