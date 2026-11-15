// Point d'entree : sert le client (public/), l'API de donnees (/api) et le
// temps reel (socket.io). Lancement : `npm start` (PORT optionnel, 3000 par defaut).

const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const { createApiRouter } = require("./api");
const { GameRooms } = require("./gameRooms");
const { registerSocketHandlers } = require("./socketHandlers");

/** Construit le serveur HTTP complet, sans l'ecouter (voir aussi les tests). */
function createServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  app.use(express.static(path.join(__dirname, "..", "public")));
  app.use("/api", createApiRouter());
  registerSocketHandlers(io, new GameRooms(io));

  return server;
}

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  createServer().listen(PORT, () => {
    console.log(`Stars Cards mini server running on http://localhost:${PORT}`);
  });
}

module.exports = { createServer };
