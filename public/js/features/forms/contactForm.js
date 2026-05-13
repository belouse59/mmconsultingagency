/**
 * features/forms/contactForm.js
 * Handles the main contact form:
 *   - Phone toggle (show/hide phone field + preferred contact time)
 *   - GDPR consent validation
 *   - HTML5 native validation fallback
 *   - API submission with loading state
 *   - Toast feedback on success/error
 *   - Form reset + button state after success
 */

import { $ } from "../../core/dom.js";
import { postForm } from "../../core/api.js";
import { showToast } from "../../core/toast.js";
import { setButtonLoading } from "../../core/button.js";
import { smoothScrollTo } from "../../core/scroll.js";

export function initContactForm() {
  const form = $("#contactForm");
  const submitBtn = $("#contact-btn");
  const phoneToggle = $("#phoneToggle");
  const phoneFieldWrap = $("#phoneFieldWrap");
  const contactTimeRow = $("#contactTimeRow");
  const consentBlock = $(".consent-block");
  const consentChk = $("#consentCheckbox") || $("#consent-checkbox");
  const consentError = $("#consentError");

  if (!form) return;

  /* Phone toggle */
  phoneToggle?.addEventListener("change", () => {
    const checked = phoneToggle.checked;
    phoneToggle.setAttribute("aria-checked", String(checked));

    /* Show/hide phone field */
    if (phoneFieldWrap) phoneFieldWrap.style.display = checked ? "block" : "none";
    const phoneInput = $("#phoneInput");
    if (phoneInput) phoneInput.required = checked;

    /* Show/hide preferred contact time */
    if (contactTimeRow) contactTimeRow.style.display = checked ? "flex" : "none";
  });

  /* Clear consent error on check */
  consentChk?.addEventListener("change", () => {
    if (consentChk.checked) {
      consentBlock?.classList.remove("error");
      consentError?.classList.remove("visible");
    }
  });

  /* Submit */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    /* Consent gate */
    if (!consentChk?.checked) {
      consentBlock?.classList.add("error");
      consentError?.classList.add("visible");
      consentBlock?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    /* HTML5 validation */
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    if (form.company.value) return;

    const payload = {
      formType: "contact",
      firstname: form.firstname?.value?.trim(),
      lastname: form.lastname?.value?.trim(),
      email: form.email?.value?.trim(),
      phone: form.phone?.value?.trim() || "",
      energyType: form.energyType?.value || "",
      contactTime: form.contactTime?.value || "",
      messageForm: form.message?.value?.trim() || "",
      consent: consentChk ? "SI" : "NO"
    };

    setButtonLoading(submitBtn, true);
    const result = await postForm(payload);

    if (result.success) {
      showToast("✓ Richiesta inviata! Ti risponderemo entro 24 ore.", "success");
      setButtonLoading(submitBtn, false, "✓ Inviato");
      submitBtn.style.background = "var(--green)";
      submitBtn.style.color = "#fff";
      submitBtn.disabled = true;
      form.reset();
      if (phoneFieldWrap) phoneFieldWrap.style.display = "none";
      if (contactTimeRow) contactTimeRow.style.display = "none";
    } else {
      showToast(result.message || "Errore durante l'invio. Riprova.", "error");
      setButtonLoading(submitBtn, false, "Invia richiesta gratuita");
    }
  });
}