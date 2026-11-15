// Donnees publiques du jeu (cartes, sorts, champions, competences, patch
// notes) consommees par le client. Ces fichiers ne sont lus qu'une fois, au
// demarrage du processus Node : redemarrer le serveur apres une modification.

const express = require("express");

const PUBLIC_DATA = {
  cards: require("../data/cards"),
  spells: require("../data/spells"),
  champions: require("../data/champions"),
  abilities: require("../data/abilities"),
  patchnotes: require("../data/patchNotes")
};

function createApiRouter() {
  const router = express.Router();
  // no-store : evite qu'un navigateur serve une reponse mise en cache apres
  // une modification des fichiers data/*.js + redemarrage du serveur.
  router.use((req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  for (const [name, data] of Object.entries(PUBLIC_DATA)) {
    router.get(`/${name}`, (req, res) => res.json(data));
  }
  return router;
}

module.exports = { createApiRouter };
