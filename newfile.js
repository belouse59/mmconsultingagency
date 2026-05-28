{
  "name": "mmconsulting",
  "version": "4.0.0",
  "description": "M&M Consulting — Energy Broker + Convenzioni Loyalty QR",
  "main": "src/server.js",
  "scripts": {
    "start":           "node src/server.js",
    "dev":             "nodemon src/server.js",
    "hash-password":   "node scripts/hash-password.js"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "@upstash/redis":      "^1.31.0",
    "bcrypt":              "^5.1.1",
    "connect-redis":       "^7.1.1",
    "cors":                "^2.8.5",
    "dotenv":              "^16.4.5",
    "express":             "^4.19.2",
    "express-rate-limit":  "^7.3.1",
    "express-session":     "^1.18.0",
    "googleapis":          "^140.0.0",
    "helmet":              "^7.1.0",
    "morgan":              "^1.10.0",
    "nodemailer":          "^6.9.14",
    "qrcode":              "^1.5.3",
    "uuid":                "^9.0.1"
  },
  "devDependencies": {
    "nodemon": "^3.1.4"
  }
}

#!/usr/bin/env node
"use strict";

/**
 * scripts/hash-password.js
 * Generates a bcrypt hash for use in .env or partner JSON.
 *
 * Usage:
 *   npm run hash-password MyPassword123
 *   node scripts/hash-password.js MyPassword123
 */

const bcrypt = require("bcrypt");

const password = process.argv[2];

if (!password) {
  console.error("\n❌  Usage: npm run hash-password <password>\n");
  process.exit(1);
}

if (password.length < 8) {
  console.error("\n❌  Password must be at least 8 characters.\n");
  process.exit(1);
}

bcrypt.hash(password, 12).then((hash) => {
  console.log("\n✅  Bcrypt hash (cost 12):\n");
  console.log(hash);
  console.log("\n📋  Paste into:");
  console.log("    .env → LOYALTY_ADMIN_PASSWORD_HASH");
  console.log("    Or use when creating a partner via admin API\n");
}).catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});

"use strict";

/**
 * config/session.js
 * Session middleware using Upstash Redis as the store.
 *
 * WHY UPSTASH REDIS:
 *   Vercel functions are stateless and ephemeral — the filesystem
 *   is read-only and temporary. connect-sqlite3 and MemoryStore both
 *   fail in production on Vercel. Upstash Redis is:
 *     - Serverless-native (HTTP REST API, no persistent TCP connection)
 *     - Free tier covers an MVP easily (10k requests/day)
 *     - Sessions persist across deployments and cold starts
 *     - Works identically in local dev with the same credentials
 *
 * SETUP:
 *   1. Create a free database at https://upstash.com
 *   2. Copy UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN into .env
 */

const session     = require("express-session");
const RedisStore  = require("connect-redis").default;
const { Redis }   = require("@upstash/redis");

function createSessionMiddleware() {
  /* ── Validate required env vars ── */
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set in .env (min 32 chars). " +
      "Generate: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
    );
  }

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in .env. " +
      "Get them from https://upstash.com"
    );
  }

  /* ── Upstash Redis client ── */
  const redisClient = new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  /* ── Session store ── */
  const store = new RedisStore({
    client: redisClient,
    prefix: "mmconsulting:sess:",
    ttl:    7 * 24 * 60 * 60, // 7 days in seconds
  });

  return session({
    store,
    secret,
    name:              "mm.sid",   // custom name avoids fingerprinting
    resave:            false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days in ms
    },
  });
}

module.exports = { createSessionMiddleware };

"use strict";

/**
 * config/redis.js
 * Single shared Upstash Redis client instance.
 *
 * Upstash uses HTTP REST — no persistent TCP connection required.
 * This makes it fully compatible with Vercel serverless functions
 * where traditional Redis clients (ioredis) fail because they
 * expect a persistent connection that the runtime destroys.
 *
 * All loyalty locking, session storage, and idempotency keys
 * go through this single client.
 */

const { Redis } = require("@upstash/redis");

function createRedisClient() {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in .env\n" +
      "Get them from https://upstash.com → Your Database → REST API"
    );
  }

  return new Redis({ url, token });
}

/* Export a single shared instance — require() is cached by Node */
const redis = createRedisClient();

module.exports = redis;

"use strict";

/**
 * config/session.js
 * Express session middleware backed by Upstash Redis.
 *
 * WHY UPSTASH AND NOT connect-sqlite3:
 *   Vercel functions are stateless — the filesystem is ephemeral
 *   and read-only. SQLite and MemoryStore both fail in production.
 *   Upstash Redis uses HTTP REST, works on every serverless platform,
 *   and persists sessions across cold starts and deployments.
 *
 * Session cookie is:
 *   - httpOnly  → inaccessible to JavaScript (XSS-safe)
 *   - secure    → HTTPS only in production
 *   - sameSite  → lax (CSRF mitigation)
 *   - named     → mm.sid (obscures technology stack)
 */

const session    = require("express-session");
const RedisStore = require("connect-redis").default;
const redis      = require("./redis");

function createSessionMiddleware() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set in .env (min 32 chars).\n" +
      "Generate: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
    );
  }

  const store = new RedisStore({
    client: redis,
    prefix: "mm:sess:",
    ttl:    7 * 24 * 60 * 60, // 7 days in seconds
  });

  return session({
    store,
    secret,
    name:              "mm.sid",
    resave:            false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days in ms
    },
  });
}

module.exports = { createSessionMiddleware };

"use strict";

/**
 * services/qrService.js
 * QR token generation and verification.
 *
 * Token format:  base64url(JSON payload) + "." + HMAC-SHA256 signature
 *
 * Security properties:
 *   - Unforgeable   — HMAC-SHA256 signature with secret
 *   - Time-limited  — exp field, default 5 min (LOYALTY_QR_TTL_MS)
 *   - Replay-proof  — used token hash locked in Redis atomically
 *   - Timing-safe   — crypto.timingSafeEqual for signature comparison
 *
 * The QR encodes a full URL so partner devices can open it as a
 * deep link that pre-fills the token on the scan page.
 */

const crypto = require("crypto");
const QRCode = require("qrcode");

/* ── Secret ── */
function _getSecret() {
  const s = process.env.LOYALTY_QR_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "LOYALTY_QR_SECRET must be set in .env (min 32 chars).\n" +
      "Generate: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
    );
  }
  return s;
}

const TTL_MS = parseInt(process.env.LOYALTY_QR_TTL_MS || "300000", 10);

/* ── Helpers ── */
function _b64url(str) {
  return Buffer.from(str).toString("base64url");
}

function _sign(payload) {
  return crypto.createHmac("sha256", _getSecret()).update(payload).digest("base64url");
}

/* ─────────────────────────────────────────────────────────────
   CUSTOMER ID — stable, never in QR payload
───────────────────────────────────────────────────────────── */
function generateCustomerId() {
  return `c-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
}

/* ─────────────────────────────────────────────────────────────
   TOKEN GENERATION
───────────────────────────────────────────────────────────── */
function generateQrToken(customerId) {
  const now     = Date.now();
  const payload = _b64url(JSON.stringify({ cid: customerId, iat: now, exp: now + TTL_MS }));
  return `${payload}.${_sign(payload)}`;
}

/* ─────────────────────────────────────────────────────────────
   TOKEN VERIFICATION
───────────────────────────────────────────────────────────── */
function verifyQrToken(token) {
  if (!token || typeof token !== "string") return { valid: false, reason: "TOKEN_MISSING" };

  const parts = token.split(".");
  if (parts.length !== 2) return { valid: false, reason: "TOKEN_MALFORMED" };

  const [payload, sig] = parts;

  const expectedSig = _sign(payload);
  const sigBuf      = Buffer.from(sig,         "base64url");
  const expBuf      = Buffer.from(expectedSig, "base64url");

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, reason: "TOKEN_INVALID_SIGNATURE" };
  }

  let data;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return { valid: false, reason: "TOKEN_MALFORMED" };
  }

  if (!data.exp || Date.now() > data.exp) return { valid: false, reason: "TOKEN_EXPIRED" };
  if (!data.cid)                           return { valid: false, reason: "TOKEN_MALFORMED" };

  return { valid: true, customerId: data.cid, exp: data.exp, token };
}

/* ─────────────────────────────────────────────────────────────
   QR IMAGE — encodes the full scan URL, not just the token
───────────────────────────────────────────────────────────── */
async function generateQrImage(customerId) {
  const token   = generateQrToken(customerId);
  const base    = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const scanUrl = `${base}/loyalty/partner/scan.html?token=${encodeURIComponent(token)}`;

  const qrImage = await QRCode.toDataURL(scanUrl, {
    errorCorrectionLevel: "H",
    margin: 2,
    width:  320,
    color:  { dark: "#0A1628", light: "#FFFFFF" },
  });

  return { qrImage, ttl: TTL_MS };
}

function getQrTtl() { return TTL_MS; }

module.exports = { generateCustomerId, generateQrToken, verifyQrToken, generateQrImage, getQrTtl };