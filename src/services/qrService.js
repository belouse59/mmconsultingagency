"use strict";

/**
 * services/qrService.js
 *
 * CHANGES FROM ORIGINAL:
 *   - generateQrToken() removed — static tokens are gone
 *   - generateCustomerId() → stable UUID for customer identity in Sheets
 *   - generateQrToken() → HMAC-SHA256 signed, TTL-bound token
 *   - verifyQrToken()   → validates signature + expiry
 *   - generateQrImage() → encodes a signed URL, not a raw token
 *
 * Token format: base64url(JSON) + "." + HMAC-SHA256
 *
 * Security properties:
 *   - Unforgeable (HMAC signature)
 *   - Time-limited (default 5 min via LOYALTY_QR_TTL_MS)
 *   - Replay-protected (usedToken stored in Redemptions sheet by service layer)
 *   - timingSafeEqual prevents timing side-channel on verification
 */

const crypto = require("crypto");
const QRCode = require("qrcode");

/* ── Config ── */
function _getSecret() {
  const s = process.env.LOYALTY_QR_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "LOYALTY_QR_SECRET must be set in .env (min 32 chars). " +
      "Generate with: node -e \"console.log(require('crypto').randomBytes(48).toString('hex'))\""
    );
  }
  return s;
}

const TTL_MS = parseInt(process.env.LOYALTY_QR_TTL_MS || "300000", 10); // 5 min default

/* ── Internal helpers ── */
function _b64url(str) {
  return Buffer.from(str).toString("base64url");
}

function _sign(payload) {
  return crypto
    .createHmac("sha256", _getSecret())
    .update(payload)
    .digest("base64url");
}

/* ─────────────────────────────────────────────────────────────
   QR TOKEN GENERATION
   Called fresh on every GET /api/loyalty/qr/:customerId
   Returns a short-lived signed token.
───────────────────────────────────────────────────────────── */

/**
 * Generate a signed, time-limited QR token for a customer.
 * @param {string} customerId — the stable customer ID from Sheets
 * @returns {string} — signed token
 */
function generateQrToken(customerId) {
  const now     = Date.now();
  const payload = _b64url(JSON.stringify({
    cid: customerId,
    iat: now,
    exp: now + TTL_MS,
  }));
  const sig = _sign(payload);
  return `${payload}.${sig}`;
}

/* ─────────────────────────────────────────────────────────────
   QR TOKEN VERIFICATION
───────────────────────────────────────────────────────────── */

/**
 * Verify a token scanned from a QR code.
 * @param {string} token
 * @returns {{ valid: true, customerId: string, token: string }
 *          |{ valid: false, reason: string }}
 */
function verifyQrToken(token) {
  if (!token || typeof token !== "string") {
    return { valid: false, reason: "TOKEN_MISSING" };
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return { valid: false, reason: "TOKEN_MALFORMED" };
  }

  const [payload, sig] = parts;

  /* Timing-safe signature verification */
  const expectedSig = _sign(payload);
  const sigBuf      = Buffer.from(sig,         "base64url");
  const expBuf      = Buffer.from(expectedSig, "base64url");

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, reason: "TOKEN_INVALID_SIGNATURE" };
  }

  /* Decode payload */
  let data;
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return { valid: false, reason: "TOKEN_MALFORMED" };
  }

  /* Expiry check */
  if (!data.exp || Date.now() > data.exp) {
    return { valid: false, reason: "TOKEN_EXPIRED" };
  }

  if (!data.cid) {
    return { valid: false, reason: "TOKEN_MALFORMED" };
  }

  return { valid: true, customerId: data.cid, exp: data.exp, token };
}

/* ─────────────────────────────────────────────────────────────
   QR IMAGE GENERATION
   Encodes the full scan URL, not just the raw token.
   Partner devices open the URL → pre-fills token on scan page.
───────────────────────────────────────────────────────────── */

/**
 * Generate a base64 PNG QR image for a customer.
 * @param {string} customerId
 * @returns {Promise<{ qrImage: string, ttl: number }>}
 */
async function generateQrImage(customerId) {
  const token   = generateQrToken(customerId);
  const baseUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const scanUrl = `${baseUrl}/loyalty/partner/scan.html?token=${encodeURIComponent(token)}`;

  const qrImage = await QRCode.toDataURL(scanUrl, {
    errorCorrectionLevel: "H",
    margin:  2,
    width:   320,
    color:   {
      dark:  "#0A1628",  // --navy
      light: "#FFFFFF",
    },
  });

  return { qrImage, ttl: TTL_MS };
}

/**
 * Exposed TTL so frontend can display a countdown.
 */
function getQrTtl() {
  return TTL_MS;
}

module.exports = {
  generateQrToken,
  verifyQrToken,
  generateQrImage,
  getQrTtl,
};