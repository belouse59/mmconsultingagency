const crypto = require("crypto");
/* ─────────────────────────────────────────────────────────────
   Stable UUID
───────────────────────────────────────────────────────────── */
function generateUUID() {
  return `c-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
}

module.exports = { generateUUID };