#!/usr/bin/env node
/* Assemble le jeu en UN SEUL fichier HTML autonome (CSS + JS en ligne).
 *   node tools/build-single.js [fichier_de_sortie]      (défaut : dist/stick-clash.html)
 * Pratique pour l'envoyer, l'archiver ou l'ouvrir sur un téléphone. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(ROOT, 'dist', 'stick-clash.html'));
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) =>
  `<style>\n${fs.readFileSync(path.join(ROOT, href), 'utf8')}\n</style>`);
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, src) =>
  `<script>\n${fs.readFileSync(path.join(ROOT, src), 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`);

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`${out} (${(html.length / 1024).toFixed(0)} Ko)`);
