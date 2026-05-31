/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */

/** Consistent error responder — never leaks stack traces in production */
export function handleError(res, err) {
  const status = err.statusCode || 500;
  const message = err.statusCode
    ? err.message
    : "Errore interno. Riprova più tardi.";

  if (!err.statusCode) {
    console.error("[loyaltyController]", err);
  }

  res.status(status).json({ success: false, message });
}
