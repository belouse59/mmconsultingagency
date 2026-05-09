"use strict";

require("dotenv").config();

const app  = require("./app");
const PORT = parseInt(process.env.PORT, 10) || 3000;

const server = app.listen(PORT, () => {
  console.log(`\n🚀  M&M Consulting server running`);
  console.log(`    ➜  http://localhost:${PORT}`);
  console.log(`    ➜  ENV: ${process.env.NODE_ENV || "development"}\n`);
});

/* Graceful shutdown */
const shutdown = (signal) => {
  console.log(`\n${signal} received — shutting down gracefully…`);
  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

/* Unhandled rejections — log but don't crash in dev */
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});