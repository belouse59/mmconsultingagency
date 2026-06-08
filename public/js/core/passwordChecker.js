/* ── Password strength ── */
import { showError } from "./loyaltyUtils.js";
import { $, $$ } from "../core/dom.js";

export function getStrength(pass) {
  let score = 0;
  if (pass.length >= 8)                          score++;
  if (pass.length >= 12)                         score++;
  if (/[A-Z]/.test(pass))                        score++;
  if (/[0-9]/.test(pass))                        score++;
  if (/[^A-Za-z0-9]/.test(pass))                score++;
  return score;
}

export function updateStrengthIndicator(pass, el) {
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

export function validate(newPassEl, confirmPassEl, errorText, errorBox) {
  const newPass     = newPassEl.value;
  const confirmPass = confirmPassEl.value;

  if (newPass.length < 8) {
    showError("La password deve contenere almeno 8 caratteri.", errorText, errorBox);
    newPassEl.focus();
    return false;
  }

  if (getStrength(newPass) < 2) {
    showError("La password è troppo debole. Aggiungi numeri o caratteri speciali.", errorText, errorBox);
    newPassEl.focus();
    return false;
  }

  if (newPass !== confirmPass) {
    showError("Le password non coincidono. Riprova.", errorText, errorBox);
    confirmPassEl.value = "";
    confirmPassEl.focus();
    return false;
  }

  return true;
}

export function enablePasswordReveal({
  selector = ".password-toggle",
  timeout = 5000,
} = {}) {
  const timers = new WeakMap();

  $$(selector).forEach((btn) => {
    btn.addEventListener("click", () => {
      const wrapper = btn.closest(".password-wrapper");
      const input = wrapper?.querySelector('input[type="password"], input[type="text"]');

      if (!input) return;

      const isHidden = input.type === "password";

      if (timers.has(input)) {
        clearTimeout(timers.get(input));
      }

      if (isHidden) {
        input.type = "text";
        btn.textContent = "🔓";

        const timer = setTimeout(() => {
          input.type = "password";
          btn.textContent = "🔒";
        }, timeout);

        timers.set(input, timer);
      } else {
        input.type = "password";
        btn.textContent = "🔒";
      }
    });
  });
}