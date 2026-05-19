/**
 * utils/argon.js
 */

const argon2 = require("argon2");

/*
  Generate once with:

  node -e "
    const argon2 = require('argon2');
    argon2.hash('dummy-password', {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    }).then(console.log);
  "
*/
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQ$Xw6o8v1l+2E4m8m1GQ2A8P3d7wQ0M6x9Qk2V8K9L1xY";

/*
  Recommended Argon2id settings for web apps.
  Adjust upward later if your servers can handle it.
*/
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

/**
 * Hash a plaintext password
 */
async function hashPassword(password) {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("Password must be a non-empty string");
  }
  return await argon2.hash(password, ARGON2_OPTIONS);
}

/**
 * Verify password against stored user hash
 *
 * Always performs Argon2 verification even if user does not exist,
 * reducing username enumeration timing attacks.
 */
async function verifyPassword(password, user) {
  const hashToCheck = user?.passwordHash || DUMMY_HASH;

  try {
    return await argon2.verify(hashToCheck, password);
  } catch {
    return false;
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
};
