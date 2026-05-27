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

/* ── Helpers ── */
function showError(msg) {
  errorText.textContent = msg;
  errorBox.classList.add("visible");
  errorBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function hideError() {
  errorBox.classList.remove("visible");
}

function setLoading(on) {
  submitBtn.disabled = on;
  submitBtn.classList.toggle("loading", on);
}

function safeRedirect(fallback) {
  const p    = new URLSearchParams(window.location.search).get("next");
  const dest = p && p.startsWith("/") && !p.startsWith("//") ? p : fallback;
  window.location.replace(dest);
}

/* ── Form submit ── */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  const identifier = identifierEl.value.trim();
  const password   = passwordEl.value;

  if (!identifier) { showError("Inserisci la tua email o numero di telefono."); identifierEl.focus(); return; }
  if (!password)   { showError("Inserisci la password."); passwordEl.focus(); return; }

  setLoading(true);

  try {
    const res  = await fetch("/api/loyalty/customer/login", {
      method:      "POST",
      credentials: "same-origin",
      headers:     { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
      body:        JSON.stringify({ identifier, password }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      safeRedirect("/loyalty/customer/dashboard.html");
    } else {
      showError(data.message || "Credenziali non valide. Riprova.");
      passwordEl.value = "";
      passwordEl.focus();
      setLoading(false);
    }
  } catch {
    showError("Errore di connessione. Controlla la rete e riprova.");
    setLoading(false);
  }
});

/* ── Clear error on input ── */
[identifierEl, passwordEl].forEach((el) => el.addEventListener("input", hideError));
logout($logout, "/");