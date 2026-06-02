/**
 * js/features/loyalty/partner/setPassword.js
 * Partner first-login forced password change.
 *
 * - Only reachable when mustChangePassword=true in session
 *   (HTML inline guard already verified this before paint)
 * - Password strength indicator gives real-time feedback
 * - Confirms match before submitting
 * - X-Requested-With header (CSRF mitigation)
 * - Redirects to scan page on success
 * - All strings in Italian
 */

/* ── DOM refs ── */
import { $ } from "../../../core/dom.js";
import { validate, getStrength, updateStrengthIndicator } from "../../../core/passwordChecker.js";
import { logout } from "../../../core/logout.js";
const form          = $("#setPasswordForm");
const newPassEl     = $("#newPassword");
const confirmPassEl = $("#confirmPassword");
const submitBtn     = $("#submitBtn");
const errorBox      = $("#setPassError");
const errorText     = $("#setPassErrorText");
const successBox    = $("#setPassSuccess");
const strengthFill  = $("#strengthFill");
const strengthLabel = $("#strengthLabel");

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

/* ── Real-time strength feedback ── */
newPassEl.addEventListener("input", () => {
  hideError();
  updateStrengthIndicator(newPassEl.value);
});

confirmPassEl.addEventListener("input", hideError);

/* ── Form submit ── */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();

  if (!validate(newPassEl, confirmPassEl)) return;

  const newPassword     = newPassEl.value;
  const confirmPassword = confirmPassEl.value;

  setLoading(true);

  try {
    const res = await fetch("/api/loyalty/partner/set-password", {
      method:      "POST",
      credentials: "same-origin",
      headers:     { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
      body:        JSON.stringify({ newPassword, confirmPassword }),
    });

    const { data, success, message } = await res.json();

    if (res.ok && success) {
      showSuccess();
      /* Short delay so user reads the success message before redirect */
      setTimeout(() => window.location.replace("/loyalty/partner/scan"), 1500);
    } else {
      showError(message || "Errore durante l'aggiornamento della password. Riprova.");
      setLoading(false);
    }
  } catch {
    showError("Errore di connessione. Controlla la rete e riprova.");
    setLoading(false);
  }
});