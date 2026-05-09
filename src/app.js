"use strict";

require("dotenv").config();

const express  = require("express");
const path     = require("path");
const helmet   = require("helmet");
const cors     = require("cors");
const morgan   = require("morgan");

const CSP_CONFIG       = require("./config/csp");
const partnerRoutes    = require("./routes/partnerRoutes");
const providerRoutes   = require("./routes/providerRoutes");
const teamRoutes       = require("./routes/teamRoutes");
const formRoutes       = require("./routes/formRoutes");

const app = express();

/* ─────────────────────────────────────────────────────────────
   SECURITY MIDDLEWARE
───────────────────────────────────────────────────────────── */

// Helmet — sets all security headers in a single call (no double-apply)
app.use(helmet(CSP_CONFIG));

// CORS — restricted to your domain only
const allowedOrigins = (process.env.ALLOWED_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow server-to-server calls (no Origin header) and listed origins
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
    optionsSuccessStatus: 200,
  })
);

/* ─────────────────────────────────────────────────────────────
   GENERAL MIDDLEWARE
───────────────────────────────────────────────────────────── */

app.use(express.json({ limit: "50kb" })); // guard against large payloads
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

/* ─────────────────────────────────────────────────────────────
   API ROUTES
───────────────────────────────────────────────────────────── */

app.use("/api/partners",  partnerRoutes);
app.use("/api/providers", providerRoutes);
app.use("/api/team",      teamRoutes);
app.use("/api/form",      formRoutes);

/* ─────────────────────────────────────────────────────────────
   STATIC FILES
───────────────────────────────────────────────────────────── */

app.use(express.static(path.join(__dirname, "../public"), {
  maxAge: process.env.NODE_ENV === "production" ? "7d" : 0,
  etag:   true,
  // Never cache index.html so SEO/meta changes deploy immediately
  setHeaders(res, filePath) {
    if (filePath.endsWith("index.html")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    }
  },
}));

/* ─────────────────────────────────────────────────────────────
   HEALTH CHECK
───────────────────────────────────────────────────────────── */

app.get("/health", (req, res) => {
  res.json({
    status:  "ok",
    project: "M&M Consulting",
    env:     process.env.NODE_ENV || "development",
    ts:      new Date().toISOString(),
  });
});

/* ─────────────────────────────────────────────────────────────
   SPA FALLBACK — always serve index.html for unknown GET routes
───────────────────────────────────────────────────────────── */

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

/* ─────────────────────────────────────────────────────────────
   GLOBAL ERROR HANDLER
───────────────────────────────────────────────────────────── */

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("[Error]", err.message);
  res.status(err.status || 500).json({
    status:  "error",
    message: process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message,
  });
});

module.exports = app;