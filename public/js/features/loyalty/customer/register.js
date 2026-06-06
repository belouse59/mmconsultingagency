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
import { validate, getStrength, updateStrengthIndicator } from "../../../core/passwordChecker.js";
import { setLoading, showError, hideError, showSuccess, safeRedirect } from "../../../core/loyaltyUtils.js";
import { logout } from "../../../core/logout.js";
const form = $("#registerForm");
const fullNameEl = $("#full_name");
const identifierEl = $("#identifier");
const passwordEl = $("#password");
const confirmPassEl = $("#confirmPassword");
const submitBtn = $("#submitBtn");
const errorBox = $("#registerError");
const errorText = $("#registerErrorText");
const successBox = $("#registerSuccess");
const $logout = $("#logoutBtn");


function isEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(str);
}

function isPhone(str) {
  return /^\+?[\d\s\-().]{7,20}$/.test(str);
}

/* ── Client-side validation ── */
function validateName() {
  const name = fullNameEl.value.trim();
  const ident = identifierEl.value.trim();

  if (name.length < 2) {
    showError("Inserisci il tuo nome completo (minimo 2 caratteri).", errorText, errorBox);
    fullNameEl.focus();
    return false;
  }

  if (!ident) {
    showError("Inserisci la tua email o numero di telefono.", errorText, errorBox);
    identifierEl.focus();
    return false;
  }

  if (!isEmail(ident) && !isPhone(ident)) {
    showError("Inserisci un'email valida (es. mario@email.com) o un numero di telefono valido.", errorText, errorBox);
    identifierEl.focus();
    return false;
  }
  return true;
}
/* ── Real-time strength feedback ── */
passwordEl.addEventListener("input", () => {
  hideError(errorBox);
  updateStrengthIndicator(passwordEl.value);
});

confirmPassEl.addEventListener("input", () => hideError(errorBox));

/* ── Form submit ── */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError(errorBox);
  if (!validateName() || !validate(passwordEl, confirmPassEl)) return;

  const full_name = fullNameEl.value.trim();
  const identifier = identifierEl.value.trim();
  const password = passwordEl.value;

  setLoading(submitBtn, true);

  try {
    const res = await fetch("/api/loyalty/customer/register", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
      body: JSON.stringify({ full_name, identifier, password }),
    });

    const { data, success, message, token } = await res.json();

    if (res.ok && success) {
      showSuccess(successBox, errorBox);
      const payload = {
        full_name: data.full_name,
      };
      sessionStorage.removeItem("registrationSuccess");
      sessionStorage.setItem(
        "registrationSuccess",
        encode(payload)
      );
      setTimeout(
        () => window.location.href = `${window.location.origin}/loyalty/customer/register-customer.html`
        , 1200
      );
    } else {
      showError(message || "Errore durante la registrazione. Riprova.", errorText, errorBox);
    }
  } catch {
    showError("Errore di connessione. Controlla la rete e riprova.", errorText, errorBox);

  }
  finally {
    setLoading(submitBtn, false);
  }
});

/* ── Clear error on input ── */
[fullNameEl, identifierEl, passwordEl, confirmPassEl].forEach((el) =>
  el.addEventListener("input", () => hideError(errorBox))
);


logout($logout, "/");

(async () => {
  if (!window.location.pathname.includes("/register")) return;

  try {
    const r = await fetch("/api/loyalty/customer/session", {
      credentials: "same-origin",
    });

    if (r.ok) {
      window.location.href = "/loyalty/customer/dashboard";
    }
  } catch {
    // stay on register page
  }
})();

function encode(data) {
  return btoa(
    encodeURIComponent(
      JSON.stringify(data)
    )
  );
}
