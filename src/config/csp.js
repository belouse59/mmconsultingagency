"use strict";

/**
 * Content Security Policy configuration.
 * Passed directly to helmet() — no double middleware.
 */
const CSP_CONFIG = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],

      scriptSrc: [
        "'self'",
        "https://cdnjs.cloudflare.com",
        "https://unpkg.com"
      ],

      styleSrc: [
        "'self'",
        "'unsafe-inline'",           // Required for Google Fonts @import
        "https://fonts.googleapis.com",
        "https://cdnjs.cloudflare.com",
      ],

      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdnjs.cloudflare.com",
        "data:",
      ],

      imgSrc: [
        "'self'",
        "data:",
        "https://cdn-icons-png.flaticon.com", // WhatsApp icon fallback
      ],

      connectSrc: ["'self'"],

      frameSrc: [
        "'self'",
        "https://www.google.com",    // Google Maps embed
      ],

      objectSrc:  ["'none'"],
      baseUri:    ["'self'"],
      formAction: ["'self'"],

      upgradeInsecureRequests: [],
    },
  },

  // Disable x-powered-by
  hidePoweredBy: true,

  // HSTS — 1 year, include subdomains
  hsts: {
    maxAge:            31536000,
    includeSubDomains: true,
    preload:           true,
  },

  // Prevent iframe embedding from other origins
  frameguard: { action: "sameorigin" },

  // Prevent MIME sniffing
  noSniff: true,

  // XSS filter
  xssFilter: true,

  // Referrer
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
};

module.exports = CSP_CONFIG;