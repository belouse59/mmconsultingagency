/**
 * js/features/loyalty/customer/register.js
 * Customer registration page logic.
 *
 * Responsibilities:
 *   - Full client-side validation before any network call
 *   - POST to /api/loyalty/customer/register
 *   - Session cookie set server-side on success — no localStorage
 *   - Redirect to dashboard after successful registration
 *   - Prevent double-submit with loading state
 *   - Clear, Italian error messages
 */

/* ── DOM refs ── */
import { $ } from "../../../core/dom.js";
import { logout } from "../../../core/logout.js";
const form            = $("#registerForm");
const fullNameEl      = $("#full_name");
const identifierEl    = $("#identifier");
const passwordEl      = $("#password");
const confirmPassEl   = $("#confirmPassword");
const submitBtn       = $("#submitBtn");
const errorBox        = $("#registerError");
const errorText       = $("#registerErrorText");
const successBox      = $("#registerSuccess");
const $logout         = $("#logoutBtn");
/* ── Helpers ── */
function showError(msg) {
  errorText.textContent = msg;
  errorBox.classList.add("visible");
  successBox.classList.remove("visible");
  errorBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function hideError() {
  errorBox.classList.remove("visible");
}

function showSuccess() {
  successBox.classList.add("visible");
  errorBox.classList.remove("visible");
}

function setLoading(loading) {
  submitBtn.disabled = loading;
  submitBtn.classList.toggle("loading", loading);
}

function isEmailFormat(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(str);
}

function isPhoneFormat(str) {
  /* Accepts Italian and international formats: +39 333 0000000, 3330000000, etc. */
  return /^\+?[\d\s\-().]{7,20}$/.test(str);
}

/* ── Client-side validation ── */
function validate() {
  const fullName    = fullNameEl.value.trim();
  const identifier  = identifierEl.value.trim();
  const password    = passwordEl.value;
  const confirmPass = confirmPassEl.value;

  if (fullName.length < 2) {
    showError("Inserisci il tuo nome completo (almeno 2 caratteri).");
    fullNameEl.focus();
    return false;
  }

  if (!identifier) {
    showError("Inserisci la tua email o numero di telefono.");
    identifierEl.focus();
    return false;
  }

  const isEmail = isEmailFormat(identifier);
  const isPhone = isPhoneFormat(identifier);

  if (!isEmail && !isPhone) {
    showError("Inserisci un indirizzo email valido (es. mario@email.com) o un numero di telefono valido.");
    identifierEl.focus();
    return false;
  }

  if (password.length < 8) {
    showError("La password deve contenere almeno 8 caratteri.");
    passwordEl.focus();
    return false;
  }

  if (password !== confirmPass) {
    showError("Le password non coincidono. Riprova.");
    confirmPassEl.value = "";
    confirmPassEl.focus();
    return false;
  }

  return true;
}

/* ── Session check on load ──
   Already logged-in users are redirected immediately */
async function checkExistingSession() {
  try {
    const res = await fetch("/api/loyalty/customer/session", {
      credentials: "same-origin",
    });
    if (res.ok) {
      window.location.replace("/loyalty/customer/dashboard.html");
    }
  } catch {
    /* No session — stay on register page */
  }
}

/* ── Form submit ── */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  if (!validate()) return;

  const fullName   = fullNameEl.value.trim();
  const identifier = identifierEl.value.trim();
  const password   = passwordEl.value;

  setLoading(true);

  try {
    const res  = await fetch("/api/loyalty/customer/register", {
      method:      "POST",
      credentials: "same-origin",
      headers:     { "Content-Type": "application/json" },
      body:        JSON.stringify({ full_name: fullName, identifier, password }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      showSuccess();
      /* Session cookie set by server — redirect after short delay */
      setTimeout(() => {
        window.location.replace("/loyalty/customer/dashboard.html");
      }, 1200);
    } else {
      showError(data.message || "Errore durante la registrazione. Riprova.");
      setLoading(false);
    }
  } catch {
    showError("Errore di connessione. Controlla la rete e riprova.");
    setLoading(false);
  }
});

/* ── Clear error on input ── */
[fullNameEl, identifierEl, passwordEl, confirmPassEl].forEach((el) => {
  el.addEventListener("input", hideError);
});
logout($logout, "/");

/* ── Boot ── */
checkExistingSession();