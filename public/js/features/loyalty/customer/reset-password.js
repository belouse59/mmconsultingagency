import { $ } from "../../../core/dom.js";
import {
  validate,
  getStrength,
  updateStrengthIndicator,
  enablePasswordReveal
} from "../../../core/passwordChecker.js";

import {
  setLoading,
  showError,
  hideError,
  showSuccess
} from "../../../core/loyaltyUtils.js";

const form = $("#resetPasswordForm");
const passwordEl = $("#password");
const confirmEl = $("#confirmPassword");
const submitBtn = $("#submitBtn");
const errorBox = $("#resetError");
const errorText = $("#resetErrorText");
const successBox = $("#resetSuccess");

/* ── Strength live update ── */
passwordEl.addEventListener("input", () => {
  hideError(errorBox);
  updateStrengthIndicator(passwordEl.value);
});

/* ── Clear errors ── */
[passwordEl, confirmEl].forEach(el =>
  el.addEventListener("input", () => hideError(errorBox))
);

/* ── Submit ── */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError(errorBox);

  const password = passwordEl.value;
  const confirm = confirmEl.value;

  /* 1. passwordChecker validation */
  const isValidPassword = validate(passwordEl, confirmEl, errorText, errorBox);

  if (!isValidPassword) return;

  /* 2. extra safety check (defensive UX layer) */
  if (password !== confirm) {
    showError("Le password non coincidono.", errorText, errorBox);
    return;
  }

  setLoading(submitBtn, true);

  try {
    const res = await fetch(
      "/api/loyalty/customer/reset-password",
      {
        method: "POST",

        credentials: "same-origin",

        headers: {
          "Content-Type":
            "application/json",

          "X-Requested-With":
            "XMLHttpRequest",
        },

        body: JSON.stringify({
          password,
        }),
      }
    );

    const data = await res.json();

    if (res.ok && data.success) {
      showSuccess(successBox, errorBox);

      setTimeout(() => {
        window.location.href = "/loyalty/customer/login.html";
      }, 1500);

    } else {
      showError(
        data.message || "Errore durante il reset password.",
        errorText,
        errorBox
      );
    }

  } catch (err) {
    showError(
      "Errore di connessione. Riprova più tardi.",
      errorText,
      errorBox
    );
  } finally {
    setLoading(submitBtn, false);
  }
});

/* ── Password reveal toggle ── */
enablePasswordReveal()
