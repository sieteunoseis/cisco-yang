const crypto = require("crypto");

function getRandomWord() {
  return crypto.randomBytes(4).toString("hex");
}

module.exports = { getRandomWord };
