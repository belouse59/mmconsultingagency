/**
 * js/features/loyalty/customer/auth.js
 * Customer login page logic.
 *
 * - No localStorage — session via httpOnly cookie only
 * - X-Requested-With header on all state-mutating requests (CSRF)
 * - Redirect respects ?next= param with origin safety check
 * - Password field cleared on failed attempt
 * - Error cleared on any input change
 */

/* ── DOM refs ── */
import { $ } from "../../../core/dom.js";
import { logout } from "../../../core/logout.js";
const form         = $("#loginForm");
const identifierEl = $("#identifier");
const passwordEl   = $("#password");
const submitBtn    = $("#submitBtn");
const errorBox     = $("#loginError");
const errorText    = $("#loginErrorText");
const $logout = $("#logoutBtn");
import { setLoading, showError, hideError, safeRedirect } from "../../../core/loyaltyUtils.js";

/* ── Form submit ── */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError(errorBox);

  const identifier = identifierEl.value.trim();
  const password   = passwordEl.value;

  if (!identifier) { showError("Inserisci la tua email o numero di telefono.", errorText, errorBox); identifierEl.focus(); return; }
  if (!password)   { showError("Inserisci la password.", errorText, errorBox); passwordEl.focus(); return; }

  setLoading(submitBtn,true);

  try {
    const res  = await fetch("/api/loyalty/customer/login", {
      method:      "POST",
      credentials: "same-origin",
      headers:     { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
      body:        JSON.stringify({ identifier, password }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      safeRedirect("/loyalty/customer/dashboard");
    } else {
      showError(data.message || "Credenziali non valide. Riprova.", errorText, errorBox);
      passwordEl.value = "";
      passwordEl.focus();
      setLoading(submitBtn, false);
    }
  } catch {
    showError("Errore di connessione. Controlla la rete e riprova.", errorText, errorBox);
    setLoading(submitBtn, false);
  }
});

/* ── Clear error on input ── */
[identifierEl, passwordEl].forEach((el) =>
  el.addEventListener("input", () => hideError(errorBox))
);

logout($logout, "/");

(async () => {
  if (!window.location.pathname.includes("/login")) return;

  try {
    const r = await fetch("/api/loyalty/customer/session", {
      credentials: "same-origin",
    });

    if (r.ok) {
      window.location.href = "/loyalty/customer/dashboard";
    }
  } catch {
    // stay on login page
  }
})();