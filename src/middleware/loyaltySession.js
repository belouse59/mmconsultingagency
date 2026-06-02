"use strict";

const session = require("express-session");
const { RedisStore } = require("connect-redis");

const {
  redisClient,
  connectRedis,
} = require("../utils/redis");

/* ───────────────────────────────────────────── */

const COOKIE_NAME = "mm.sid";

function createSessionMiddleware() {

  const secret =
    process.env.SESSION_SECRET;

  if (
    !secret ||
    secret.length < 32
  ) {
    throw new Error(
      "SESSION_SECRET missing"
    );
  }

  connectRedis()
    .catch(console.error);

  return session({

    store:
      new RedisStore({
        client:
          redisClient,

        prefix:
          "mmconsulting:sess:",
      }),

    secret,

    name:
      COOKIE_NAME,

    resave:
      false,

    saveUninitialized:
      false,

    rolling:
      true,

    unset:
      "destroy",

    cookie: {

      httpOnly:
        true,

      secure:
        process.env.NODE_ENV
        ===
        "production",

      sameSite:
        process.env.NODE_ENV
        ===
        "production"
          ? "none"
          : "lax",

      maxAge:
        7 *
        24 *
        60 *
        60 *
        1000,

      path:
        "/",
    },

  });

}

/* ─────────────────────────────────────────────
   API GUARDS
───────────────────────────────────────────── */

function requireCustomerAPI(
  req,
  res,
  next
) {

  if (
    req.session
    ?.loyaltyCustomer
  ) {
    return next();
  }

  return res
    .status(401)
    .json({

      success:
        false,

      message:
        "Sessione scaduta.",

    });

}

function requirePartnerAPI(
  req,
  res,
  next
) {

  const partner =
    req.session
    ?.loyaltyPartner;

  if (
    !partner
  ) {

    return res
      .status(401)
      .json({

        success:
          false,

        message:
          "Sessione scaduta.",

      });

  }

  if (
    partner
    .mustChangePassword
  ) {

    return res
      .status(403)
      .json({

        success:
          false,

        code:
          "MUST_CHANGE_PASSWORD",

        message:
          "Imposta una password.",

      });

  }

  return next();

}

function requirePartnerAnyAPI(
  req,
  res,
  next
) {

  if (
    req.session
    ?.loyaltyPartner
  ) {

    return next();

  }

  return res
    .status(401)
    .json({

      success:
        false,

      message:
        "Sessione scaduta.",

    });

}

function requireAdminAPI(
  req,
  res,
  next
) {

  if (
    req.session
    ?.loyaltyAdmin
  ) {

    return next();

  }

  return res
    .status(401)
    .json({

      success:
        false,

      message:
        "Non autorizzato.",

    });

}

/* ─────────────────────────────────────────────
   PAGE GUARDS
───────────────────────────────────────────── */

function requireCustomerPage(
  req,
  res,
  next
) {

  if (
    req.session
    ?.loyaltyCustomer
  ) {

    return next();

  }

  res.redirect(
    "/loyalty/customer/login.html"
  );

}

function requirePartnerPage(
  req,
  res,
  next
) {

  if (
    req.session
    ?.loyaltyPartner
  ) {

    return next();

  }

  res.redirect(
    "/loyalty/partner/login.html"
  );

}

function requirePartnerSetPasswordPage(
  req,
  res,
  next
) {

  const partner =
    req.session
    ?.loyaltyPartner;

  if (
    !partner
  ) {

    return res.redirect(
      "/loyalty/partner/login.html"
    );

  }

  if (
    !partner
    .mustChangePassword
  ) {

    return res.redirect(
      "/loyalty/partner/scan.html"
    );

  }

  return next();

}

function requireAdminPage(
  req,
  res,
  next
) {

  if (
    req.session
    ?.loyaltyAdmin
  ) {

    return next();

  }

  res.redirect(
    "/loyalty/admin/login.html"
  );

}

/* ─────────────────────────────────────────────
   REQUEST CHECK
───────────────────────────────────────────── */

function requireXHR(
  req,
  res,
  next
) {

  const header =
    req.headers[
      "x-requested-with"
    ];

  if (
    header !==
    "XMLHttpRequest"
  ) {

    return res
      .status(403)
      .json({

        success:
          false,

        message:
          "Richiesta non autorizzata.",

      });

  }

  next();

}

/* ───────────────────────────────────────────── */

module.exports = {
  createSessionMiddleware,
  requireCustomerPage,
  requirePartnerPage,
  requirePartnerSetPasswordPage,
  requireAdminPage,
  requireCustomerAPI,
  requirePartnerAPI,
  requirePartnerAnyAPI,
  requireAdminAPI,
  requireXHR,
};