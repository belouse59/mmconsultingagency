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

/* ── Password strength ── */
function getStrength(pass) {
  let score = 0;
  if (pass.length >= 8)                          score++;
  if (pass.length >= 12)                         score++;
  if (/[A-Z]/.test(pass))                        score++;
  if (/[0-9]/.test(pass))                        score++;
  if (/[^A-Za-z0-9]/.test(pass))                score++;
  return score;
}

function updateStrengthIndicator(pass) {
  if (!strengthFill || !strengthLabel) return;

  const score = getStrength(pass);

  const levels = [
    { pct: 0,   label: "",             color: "transparent" },
    { pct: 20,  label: "Molto debole", color: "#E5484D" },
    { pct: 40,  label: "Debole",       color: "#E5484D" },
    { pct: 60,  label: "Discreta",     color: "#D4A017" },
    { pct: 80,  label: "Buona",        color: "#0F7A3C" },
    { pct: 100, label: "Ottima",       color: "#0F7A3C" },
  ];

  const level = levels[Math.min(score, levels.length - 1)];
  strengthFill.style.width           = `${level.pct}%`;
  strengthFill.style.backgroundColor = level.color;
  strengthLabel.textContent          = pass.length > 0 ? level.label : "";
  strengthLabel.style.color          = level.color;
}

/* ── Real-time strength feedback ── */
newPassEl.addEventListener("input", () => {
  hideError();
  updateStrengthIndicator(newPassEl.value);
});

confirmPassEl.addEventListener("input", hideError);

/* ── Client-side validation ── */
function validate() {
  const newPass     = newPassEl.value;
  const confirmPass = confirmPassEl.value;

  if (newPass.length < 8) {
    showError("La password deve contenere almeno 8 caratteri.");
    newPassEl.focus();
    return false;
  }

  if (getStrength(newPass) < 2) {
    showError("La password è troppo debole. Aggiungi numeri o caratteri speciali.");
    newPassEl.focus();
    return false;
  }

  if (newPass !== confirmPass) {
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

    const data = await res.json();

    if (res.ok && data.success) {
      showSuccess();
      /* Short delay so user reads the success message before redirect */
      setTimeout(() => window.location.replace("/loyalty/partner/scan.html"), 1500);
    } else {
      showError(data.message || "Errore durante l'aggiornamento della password. Riprova.");
      setLoading(false);
    }
  } catch {
    showError("Errore di connessione. Controlla la rete e riprova.");
    setLoading(false);
  }
});