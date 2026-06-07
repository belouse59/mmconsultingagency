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
import { setLoading, showError, hideError, safeRedirect } from "../../../core/loyaltyUtils.js";
const form        = $("#partnerLoginForm");
const partnerIdEl = $("#identifier");
const passwordEl  = $("#password");
const submitBtn   = $("#submitBtn");
const errorBox    = $("#loginError");
const errorText   = $("#loginErrorText");
const $logout = $("#logoutBtn");
 
/* ── Form submit ── */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError(errorBox);
 
  const partnerId = partnerIdEl.value.trim();
  const password  = passwordEl.value;
 
  if (!partnerId) { showError("Inserisci il tuo ID Partner.", errorText, errorBox); partnerIdEl.focus(); return; }
  if (!password)  { showError("Inserisci la password.", errorText, errorBox); passwordEl.focus(); return; }
 
  setLoading(submitBtn, true);
 
  try {
    const res  = await fetch("/api/loyalty/partner/login", {
      method:      "POST",
      credentials: "same-origin",
      headers:     { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
      body:        JSON.stringify({ partnerId, password }),
    });
 
    const { data, success, message } = await res.json();
 
    if (res.ok && success) {
      /* First-login flow — must set a new password */
      if (data.mustChangePassword) {
        window.location.replace("/loyalty/partner/set-password");
      } else {
        safeRedirect("/loyalty/partner/scan");
      }
    } else {
      showError(message || "Credenziali non valide. Riprova.", errorText, errorBox);
      passwordEl.value = "";
      passwordEl.focus();
      setLoading(submitBtn,false);
    }
  } catch {
    showError("Errore di connessione. Controlla la rete e riprova.",errorText, errorBox);
    setLoading(submitBtn, false);
  }
});
 
/* ── Clear error on input ── */
[partnerIdEl, passwordEl].forEach((el) =>
  el.addEventListener("input", () => hideError(errorBox))
);

logout($logout, "/");

(async () => {
  if (!window.location.pathname.includes("/login")) return;

  try {
    const r = await fetch("/api/loyalty/partner/session", {
      credentials: "same-origin",
    });

    if (r.ok) {
      window.location.href = "/loyalty/partner/scan";
    }
  } catch {
    // stay on login page
  }
})();