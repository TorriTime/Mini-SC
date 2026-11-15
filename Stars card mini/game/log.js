// Journal de partie partage (visible par tous les joueurs).

const { LOG_HISTORY } = require("./constants");

function addLog(state, message) {
  state.log.push(message);
  if (state.log.length > LOG_HISTORY) state.log.shift();
}

module.exports = { addLog };
