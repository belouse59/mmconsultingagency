import { $ } from "../../../core/dom.js";
import { setLoading, showError, hideError, showSuccess, safeRedirect } from "../../../core/loyaltyUtils.js";

const form = $("#forgotPasswordForm");
const identifierInput = $("#identifier");

const successBox = $("#resetSuccess");
const errorBox = $("#resetError");
const errorText = $("#resetErrorText");
const submitBtn = $("#resetBtn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const identifier = identifierInput.value.trim();

  if (!identifier) {
    showError("Inserisci email o numero di telefono.");
    return;
  }

  setLoading(submitBtn, true);
  errorBox.style.display = "none";

  try {
    const res = await fetch("/api/loyalty/customer/forgot-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest"
      },
      credentials: "same-origin",
      body: JSON.stringify({ identifier }),
    });

    // IMPORTANT:
    // Always show success even if backend fails to avoid account enumeration
    showSuccess(successBox, errorBox);

  } catch (err) {
    // Even network errors should not reveal too much
    showSuccess(successBox, errorBox);
  } finally {
    setLoading(submitBtn, false);
  }
});
