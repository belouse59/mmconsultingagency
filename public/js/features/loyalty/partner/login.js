/**
 * js/features/loyalty/partner/login.js
 * Partner login page logic.
 *
 * Responsibilities:
 *   - Validate form inputs before network call
 *   - POST to /api/loyalty/partner/login
 *   - Session cookie set server-side — no localStorage
 *   - Redirect to scan page on success
 *   - Respect ?next= param for post-login redirect
 *   - Italian error messages
 */

/* ── DOM refs ── */
import { $ } from "../../../core/dom.js";
import { logout } from "../../../core/logout.js";
const form        = $("#partnerLoginForm");
const partnerIdEl = $("#partnerId");
const passwordEl  = $("#password");
const submitBtn   = $("#submitBtn");
const errorBox    = $("#loginError");
const errorText   = $("#loginErrorText");
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

function setLoading(loading) {
  submitBtn.disabled = loading;
  submitBtn.classList.toggle("loading", loading);
}

function getRedirectTarget() {
  const params = new URLSearchParams(window.location.search);
  const next   = params.get("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/loyalty/partner/scan.html";
}

/* ── Session check on load ── */
async function checkExistingSession() {
  try {
    const res = await fetch("/api/loyalty/partner/session", {
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

  const partnerId = partnerIdEl.value.trim();
  const password  = passwordEl.value;

  if (!partnerId) {
    showError("Inserisci il tuo ID Partner.");
    partnerIdEl.focus();
    return;
  }

  if (!password) {
    showError("Inserisci la password.");
    passwordEl.focus();
    return;
  }

  setLoading(true);

  try {
    const res  = await fetch("/api/loyalty/partner/login", {
      method:      "POST",
      credentials: "same-origin",
      headers:     { "Content-Type": "application/json" },
      body:        JSON.stringify({ partnerId, password }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
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
[partnerIdEl, passwordEl].forEach((el) => {
  el.addEventListener("input", hideError);
});
logout($logout, "/");

/* ── Boot ── */
checkExistingSession();