/**
 * services/sessionService.js
 */

"use strict";

/**
 * Centralized session lifecycle management.
 *
 * Responsibilities:
 * - Session regeneration on login
 * - Redis-backed session destruction
 * - Cookie cleanup
 * - Single-auth-context enforcement
 */

const COOKIE_NAME = "mm.sid";

function getCookieOptions() {
  return {
    httpOnly: true,

    secure: process.env.NODE_ENV === "production",

    sameSite:
      process.env.NODE_ENV === "production"
        ? "none"
        : "lax",

    path: "/",
  };
}

/* ─────────────────────────────────────────────────────────────
   DESTROY SESSION
───────────────────────────────────────────────────────────── */
function destroySession(req, res) {
  return new Promise((resolve, reject) => {
    if (!req.session) {
      res.clearCookie(COOKIE_NAME, getCookieOptions());
      return resolve();
    }

    req.session.destroy((err) => {
      if (err) return reject(err);

      res.clearCookie(COOKIE_NAME, getCookieOptions());

      resolve();
    });
  });
}

/* ─────────────────────────────────────────────────────────────
   REGENERATE AUTH SESSION
   Prevents session fixation attacks.
───────────────────────────────────────────────────────────── */
function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

/* ─────────────────────────────────────────────────────────────
   SAVE SESSION
───────────────────────────────────────────────────────────── */
function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

/* ─────────────────────────────────────────────────────────────
   ESTABLISH AUTH SESSION
   Enforces one authenticated identity per session.
───────────────────────────────────────────────────────────── */
async function establishSession(req, authPayload) {
  await regenerateSession(req);

  /* Ensure only ONE auth scope exists */
  delete req.session.loyaltyCustomer;
  delete req.session.loyaltyPartner;
  delete req.session.loyaltyAdmin;

  Object.assign(req.session, authPayload);

  await saveSession(req);
}

module.exports = {
  destroySession,
  regenerateSession,
  establishSession,
  saveSession,
  getCookieOptions,
};