/**
 * js/features/loyalty/customer/auth.js
 * Customer login page logic.
 *
 * Responsibilities:
 *   - Validate form inputs client-side before network call
 *   - POST credentials to /api/loyalty/customer/login
 *   - Auth state stored server-side in session (httpOnly cookie)
 *   - NO localStorage usage
 *   - Redirect to dashboard on success
 *   - Show error message on failure
 *   - Handle double-submit with button loading state
 *   - Respect ?next= param for post-login redirect
 */

/* ── DOM refs ── */
import { $ } from "../../../core/dom.js";
const form         = $("#loginForm");
const identifierEl = $("#identifier");
const passwordEl   = $("#password");
const submitBtn    = $("#submitBtn");
const errorBox     = $("#loginError");
const errorText    = $("#loginErrorText");

/* ── Helpers ── */
function showError(msg) {
  errorText.textContent = msg;
  errorBox.classList.add("visible");
  errorBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function hideError() {
  errorBox.classList.remove("visible");
}

function setLoading(loading) {
  submitBtn.disabled = loading;
  submitBtn.classList.toggle("loading", loading);
}

function getRedirectTarget() {
  const params = new URLSearchParams(window.location.search);
  const next   = params.get("next");
  /* Safety: only allow relative paths on the same origin */
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/loyalty/customer/dashboard.html";
}

/* ── Session check on load ──
   If already authenticated, skip straight to dashboard */
async function checkExistingSession() {
  try {
    const res = await fetch("/api/loyalty/customer/session", {
      credentials: "same-origin",
    });
    if (res.ok) {
      window.location.replace(getRedirectTarget());
    }
  } catch {
    /* No session — stay on login page */
  }
}

/* ── Form submit ── */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  const identifier = identifierEl.value.trim();
  const password   = passwordEl.value;

  /* Client-side validation */
  if (!identifier) {
    showError("Inserisci la tua email o numero di telefono.");
    identifierEl.focus();
    return;
  }
  if (!password) {
    showError("Inserisci la password.");
    passwordEl.focus();
    return;
  }

  setLoading(true);

  try {
    const res  = await fetch("/api/loyalty/customer/login", {
      method:      "POST",
      credentials: "same-origin",
      headers:     { "Content-Type": "application/json" },
      body:        JSON.stringify({ identifier, password }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      /* Session cookie set by server — redirect immediately */
      window.location.replace(getRedirectTarget());
    } else {
      showError(data.message || "Credenziali non valide. Riprova.");
      setLoading(false);
      passwordEl.value = "";
      passwordEl.focus();
    }
  } catch {
    showError("Errore di connessione. Controlla la rete e riprova.");
    setLoading(false);
  }
});

/* ── Clear error on input ── */
[identifierEl, passwordEl].forEach((el) => {
  el.addEventListener("input", hideError);
});

/* ── Boot ── */
checkExistingSession();