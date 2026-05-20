"use strict";

/**
 * app.js — Express application
 *
 * CHANGES FROM ORIGINAL:
 *   - Removed duplicate express.static() call
 *   - Added session middleware (required for loyalty auth)
 *   - Added /api/loyalty routes
 *   - CSP updated: added mediaSrc for camera (QR scanner), data: for QR image
 *   - Single clean static file handler
 *   - Global error handler catches anything routers miss
 */

require("dotenv").config();
const CSP_CONFIG = require("./config/csp");
const express    = require("express");
const path       = require("path");
const helmet     = require("helmet");
const cors       = require("cors");
const morgan     = require("morgan");

const { createSessionMiddleware } = require("./middleware/loyaltySession");

/* Routes */
const formRoutes     = require("./routes/formRoutes");
const partnerRoutes  = require("./routes/partnerRoutes");
const providerRoutes = require("./routes/providerRoutes");
const teamRoutes     = require("./routes/teamRoutes");
const loyaltyRoutes  = require("./routes/loyaltyRoutes");

const app = express();

/* ── Security headers ── */
app.use(helmet(CSP_CONFIG));

/* ── CORS ── */
const allowedOrigins = (process.env.ALLOWED_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,          // required for session cookies cross-origin in dev
    methods: ["GET", "POST", "DELETE"],
    allowedHeaders: ["Content-Type"],
    optionsSuccessStatus: 200,
  })
);

/* ── Body parsing ── */
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: false, limit: "50kb" }));

/* ── Logging ── */
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

/* ── Session ── (must be before any route that reads req.session) */
app.set("trust proxy", 1);
app.use(createSessionMiddleware());

/* ── API routes ── */
app.use("/api/partners",  partnerRoutes);
app.use("/api/providers", providerRoutes);
app.use("/api/team",      teamRoutes);
app.use("/api/form",      formRoutes);
app.use("/api/loyalty",   loyaltyRoutes);

/* ── Health check ── */
app.get("/health", (req, res) => {
  res.json({
    status:  "ok",
    project: "M&M Consulting",
    env:     process.env.NODE_ENV || "development",
    ts:      new Date().toISOString(),
  });
});

/* ── Static files — single handler, correct order ── */
app.use(
  express.static(path.join(__dirname, "../public"), {
    maxAge:  process.env.NODE_ENV === "production" ? "7d" : 0,
    etag:    true,
    setHeaders(res, filePath) {
      /* Never cache HTML — ensures auth state changes deploy immediately */
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      }
    },
  })
);

/* ── Global error handler ── */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[app error]", err.message || err);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === "production"
      ? "Errore interno del server."
      : err.message,
  });
});

module.exports = app;