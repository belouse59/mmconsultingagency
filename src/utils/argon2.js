/**
 * utils/argon.js
 */

const bcrypt = require("bcrypt");
const BCRYPT_ROUNDS = 12;
const hash       = await bcrypt.hash(password, BCRYPT_ROUNDS);

async function hashPassword(password) {
  const hash       = await bcrypt.hash(password, BCRYPT_ROUNDS);
  return hash;
}

async function verifyPassword(user) {
  /* Always run bcrypt even if user not found — prevents timing oracle */
  const hashToCheck = user?.passwordHash || "$2b$12$invalidhashpadding00000000000000000000000000000000000";
  const match       = await bcrypt.compare(password, hashToCheck);
  return match;
}
module.exports = {hashPassword, verifyPassword}
