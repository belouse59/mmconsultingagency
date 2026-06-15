const crypto = require("crypto");
/* ─────────────────────────────────────────────────────────────
   Stable UUID
───────────────────────────────────────────────────────────── */
function generateUUID(type) {
  return `${type}-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
}

module.exports = { generateUUID };