"use strict";

const path = require("path");

const crypto =
  require("crypto");

const customerRepo =
  require("../../repositories/loyalty/customersRepository");

const partnerRepo =
  require("../../repositories/loyalty/partnersRepository");

const passwordResetRepo =
  require("../../repositories/loyalty/passwordResetRepository");

const emailService = require("../emailService");  

const {
  hashPassword
} = require("../../utils/argon2");

const {
  makeError
} = require("../../utils/errorHandler");

const { generateUUID } = require("../../utils/generateUUID");

/* ─────────────────────────────────────────────
   CONFIG
───────────────────────────────────────────── */

const TOKEN_SIZE_BYTES      = Number(process.env.TOKEN_SIZE_BYTES) || 32;
const TOKEN_EXPIRY_MINUTES  = Number(process.env.TOKEN_EXPIRY_MINUTES) || 30;

/* ─────────────────────────────────────────────
   TOKEN GENERATION
───────────────────────────────────────────── */

function createToken() {

  const rawToken =
    crypto
      .randomBytes(TOKEN_SIZE_BYTES)
      .toString("hex");

  const tokenHash =
    crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

  const expiresAt =
    new Date(
      Date.now() +
      TOKEN_EXPIRY_MINUTES * 60 * 1000
    );

  return {
    rawToken,
    tokenHash,
    expiresAt,
  };

}

/* ─────────────────────────────────────────────
   FORGOT PASSWORD
───────────────────────────────────────────── */

async function forgotPassword({
  identifier,
  origin
}) {
  let user;
  if(origin === "customer") {
     user =
    await customerRepo
    .findCustomerByIdentifier(
      identifier
    );
  } else {
    user =
    await partnerRepo
    .findPartnerByIdentifier(
      identifier
    );
  }

  /**
   * Always respond the same way (prevents enumeration)
   */
  if (!user) {
    await new Promise(r => setTimeout(r, 1500));
    return;
  }

  const {
    rawToken,
    tokenHash,
    expiresAt
  } = createToken();

  /**
   * Invalidate previous active tokens
   */
  await passwordResetRepo
    .invalidateUserTokens(
      user.id
    );

  /**
   * Store new reset token (hashed only)
   */
  const resetRecord =
    await passwordResetRepo
      .createPasswordReset({
        id: generateUUID("reset"),
        userId: user.id,
        tokenHash,
        expiresAt,
        origin
      });

  /**
   * Send email with RAW token (never store this)
   */
  await emailService
    .sendCustomerPasswordReset({
      user,
      token: rawToken,
      expiresAt,
      origin
    });

  return {
    success: true,
  };

}

/* ─────────────────────────────────────────────
   RESET PASSWORD
───────────────────────────────────────────── */

async function validateResetToken(
  token
) {

  const tokenHash =
    crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

  const resetRequest =
    await passwordResetRepo
      .findByTokenHash(
        tokenHash
      );

  if (
    !resetRequest ||
    resetRequest.usedAt ||
    resetRequest.expiresAt <
      new Date()
  ) {

    throw makeError(
      "Link non valido o scaduto.",
      401
    );

  }

  return resetRequest;

}

async function resetPassword({
  token,
  password,
  origin
}) {

  if (!token || !password) {
    throw makeError(
      "Richiesta non valida.",
      400
    );
  }

  /**
   * Hash incoming token
   */
  const tokenHash =
    crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

  /**
   * Find reset request in DB
   */
  const resetRequest =
    await passwordResetRepo
      .findByTokenHash(tokenHash);

  /**
   * Validate existence + state
   */
  if (
    !resetRequest ||
    resetRequest.usedAt ||
    resetRequest.expiresAt < new Date()
  ) {
    throw makeError(
      "Link non valido o scaduto.",
      401
    );
  }

  /**
   * Hash new password
   */
  const passwordHash =
    await hashPassword(password);

  /**
   * Update customer password
   */
  if( origin === "customer" ) {
    await customerRepo
    .updatePassword({
      customerId: resetRequest.userId,
      passwordHash,
    });
  } else {
    await partnerRepo
    .updatePassword({
      partnerId: resetRequest.userId,
      passwordHash,
    });
  }

  /**
   * Mark token as used (prevents replay)
   */
  await passwordResetRepo
    .markUsed(resetRequest.id);

  return {
    success: true,
  };

}

/* ───────────────────────────────────────────── */

module.exports = {
  forgotPassword,
  resetPassword,
  validateResetToken
};