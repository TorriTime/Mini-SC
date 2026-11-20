/* Charge dans Node les scripts « moteur + données » listés dans index.html
 * (donc index.html reste la seule source de vérité de l'ordre de chargement).
 * Les dossiers render/ ui/ et main.js (qui ont besoin du DOM) sont ignorés. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

function scriptList() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  return [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
}

function loadEngine() {
  for (const src of scriptList()) {
    if (/^js\/(render|ui)\//.test(src) || src === 'js/main.js') continue;
    vm.runInThisContext(fs.readFileSync(path.join(ROOT, src), 'utf8'), { filename: src });
  }
  return globalThis.SC;
}

module.exports = { loadEngine, scriptList, ROOT };
