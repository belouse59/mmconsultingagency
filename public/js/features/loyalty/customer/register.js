/**
 * js/features/loyalty/customer/register.js
 * Customer registration page logic.
 *
 * - Full client-side validation before any network call
 * - X-Requested-With header on POST (CSRF mitigation)
 * - No localStorage — session via httpOnly cookie
 * - Redirect to dashboard after successful registration
 * - Password match + strength validation
 * - All error messages in Italian
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
 
function setLoading(on) {
  submitBtn.disabled = on;
  submitBtn.classList.toggle("loading", on);
}
 
function isEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(str);
}
 
function isPhone(str) {
  return /^\+?[\d\s\-().]{7,20}$/.test(str);
}
 
/* ── Client-side validation ── */
function validate() {
  const name     = fullNameEl.value.trim();
  const ident    = identifierEl.value.trim();
  const pass     = passwordEl.value;
  const confirm  = confirmPassEl.value;
 
  if (name.length < 2) {
    showError("Inserisci il tuo nome completo (minimo 2 caratteri).");
    fullNameEl.focus();
    return false;
  }
 
  if (!ident) {
    showError("Inserisci la tua email o numero di telefono.");
    identifierEl.focus();
    return false;
  }
 
  if (!isEmail(ident) && !isPhone(ident)) {
    showError("Inserisci un'email valida (es. mario@email.com) o un numero di telefono valido.");
    identifierEl.focus();
    return false;
  }
 
  if (pass.length < 8) {
    showError("La password deve contenere almeno 8 caratteri.");
    passwordEl.focus();
    return false;
  }
 
  if (pass !== confirm) {
    showError("Le password non coincidono. Riprova.");
    confirmPassEl.value = "";
    confirmPassEl.focus();
    return false;
  }
 
  return true;
}
 
/* ── Form submit ── */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();
 
  if (!validate()) return;
 
  const full_name  = fullNameEl.value.trim();
  const identifier = identifierEl.value.trim();
  const password   = passwordEl.value;
 
  setLoading(true);
 
  try {
    const res  = await fetch("/api/loyalty/customer/register", {
      method:      "POST",
      credentials: "same-origin",
      headers:     { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
      body:        JSON.stringify({ full_name, identifier, password }),
    });
 
    const data = await res.json();
 
    if (res.ok && data.success) {
      showSuccess();
      setTimeout(() => window.location.replace("/loyalty/customer/dashboard.html"), 1200);
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
[fullNameEl, identifierEl, passwordEl, confirmPassEl].forEach((el) =>
  el.addEventListener("input", hideError)
);

logout($logout, "/");