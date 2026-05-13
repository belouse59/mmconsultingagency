/**
 * features/forms/newsletter.js
 * Footer newsletter form:
 *   - Email validation (native + API-level duplicate check)
 *   - API submission with loading state
 *   - Toast feedback, button permanently disabled on success
 */

import { $ } from "../../core/dom.js";
import { postForm } from "../../core/api.js";
import { showToast } from "../../core/toast.js";
import { setButtonLoading } from "../../core/button.js";

export function initNewsletter() {
  const form = $("#newsletterForm");
  const btn  = $("#newsletter-btn");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const emailInput = form.email;
    const email      = emailInput?.value?.trim();

    /* Native email validation */
    if (!email || !emailInput?.checkValidity()) {
      showToast("Inserisci un indirizzo email valido.", "error");
      emailInput?.focus();
      return;
    }

    setButtonLoading(btn, true);
    const result = await postForm({ formType: "newsletter", email });

    if (result.success) {
      showToast("✓ Iscrizione confermata! Grazie.", "success");
      setButtonLoading(btn, false, "✓ Iscritto");
      btn.style.background = "var(--green)";
      btn.style.color      = "#fff";
      btn.disabled         = true;
      form.reset();
    } else {
      const msg = result.message === "Already subscribed"
        ? "Questa email è già iscritta alla newsletter."
        : result.message || "Errore durante l'iscrizione. Riprova.";
      showToast(msg, "error");
      setButtonLoading(btn, false, "Iscriviti");
    }
  });
}