/**
 * public/js/components/contactForm.js
 *
 * Reusable contact form component.
 *
 * Replaces:
 *   - public/js/features/forms/contactForm.js        (homepage energy form)
 *   - inline contact form JS in loyalty-landing.html  (loyalty form)
 *
 * ─────────────────────────────────────────────────────────
 * Usage
 * ─────────────────────────────────────────────────────────
 *
 *   import { initContactForm } from "../../components/contactForm.js";
 *
 *   // Homepage energy form
 *   initContactForm({
 *     formId:        "contactForm",
 *     submitBtnId:   "contact-btn",
 *     source:        "home",
 *     formType:      "contact",        // routes to contactService
 *     selectField:   "energyType",
 *     successMessage: "✓ Richiesta inviata! Ti risponderemo entro 24 ore.",
 *   });
 *
 *   // Loyalty contact form
 *   initContactForm({
 *     formId:        "lcContactForm",
 *     submitBtnId:   "lcContactSubmit",
 *     source:        "loyalty",
 *     formType:      "loyalty",        // also routes to contactService
 *     selectField:   "contactType",
 *     successMessage: "✓ Messaggio inviato! Ti risponderemo entro 24 ore.",
 *   });
 *
 * ─────────────────────────────────────────────────────────
 * Config options
 * ─────────────────────────────────────────────────────────
 *
 * @param {object}  config
 * @param {string}  config.formId
 *   The `id` of the <form> element.
 *
 * @param {string}  config.submitBtnId
 *   The `id` of the submit <button>.
 *
 * @param {string}  [config.source="home"]
 *   Lead source identifier. Included in the API payload for
 *   backend reporting. Values: "home" | "loyalty".
 *
 * @param {string}  [config.formType="contact"]
 *   Form variant identifier — also doubles as the backend
 *   routing key. formController.js's CONTACT_FORM_TYPES list
 *   must contain this value or the request returns 400.
 *   Currently valid: "contact" (homepage), "loyalty" (loyalty page).
 *
 * @param {string}  [config.selectField="energyType"]
 *   The `name` attribute of the category select field.
 *   Used to extract the selected value for the payload.
 *   Pass null to skip the select entirely.
 *
 * @param {string}  [config.successMessage]
 *   Toast message shown on successful submission.
 *
 * ─────────────────────────────────────────────────────────
 * Expected HTML structure
 * ─────────────────────────────────────────────────────────
 *
 *   <form id="{formId}" novalidate>
 *
 *     <!-- Honeypot (required) -->
 *     <input type="text" name="company" class="honeypot" ...>
 *
 *     <!-- Name fields -->
 *     <input name="firstname" ...>
 *     <input name="lastname"  ...>
 *
 *     <!-- Email -->
 *     <input type="email" name="email" required ...>
 *
 *     <!-- Phone (optional, shown by toggle) -->
 *     <!-- Toggle: <input type="checkbox" id="{formId}-phone-toggle"> -->
 *     <!-- Phone wrap: any element with data-phone-wrap -->
 *     <!-- Phone input: <input type="tel" name="phone"> -->
 *     <!-- Contact time row: any element with data-contact-time-row -->
 *
 *     <!-- Category select (optional) -->
 *     <!-- <select name="{selectField}" required> -->
 *
 *     <!-- Message -->
 *     <!-- <textarea name="message"> -->
 *
 *     <!-- Consent (required) -->
 *     <!-- <input type="checkbox" data-consent required> -->
 *     <!-- <div class="consent-block" data-consent-block> -->
 *     <!-- <span class="consent-error" data-consent-error> -->
 *
 *   </form>
 *   <button id="{submitBtnId}" type="submit" form="{formId}">…</button>
 *
 *   OR the button may be inside the form — both work.
 *
 * ─────────────────────────────────────────────────────────
 * Payload sent to the API
 * ─────────────────────────────────────────────────────────
 *
 * POSTs to /api/form/submit (via postForm in core/api.js).
 * formController.submitForm() routes by `formType`:
 *   "contact" | "loyalty" → contactService.submit()
 *   "newsletter"          → newsletterService.subscribe()
 *   "simulator"           → simulatorService.submit()
 *
 *   {
 *     source:      "home" | "loyalty" | ...
 *     formType:    "contact" | "loyalty"
 *     category:    "Gas" | "Elettricità" | "Entrambi"
 *                  | "Cliente" | "Partner" | "Info" | ""
 *     firstname:   string,
 *     lastname:    string,
 *     email:       string,
 *     phone:       string,
 *     contactTime: string,
 *     messageForm: string,
 *     consent:     "SI"
 *   }
 *
 * IMPORTANT — formType is also the backend routing key:
 *   formController.js checks `formType` against a fixed list
 *   (CONTACT_FORM_TYPES = ["contact", "loyalty"]) to decide
 *   whether to call contactService.submit(). The `formType`
 *   you configure here must be one of those values or the
 *   request returns 400. If you add a new contact-style form
 *   variant, add its formType string to CONTACT_FORM_TYPES in
 *   formController.js first.
 *
 *
 * @module contactForm
 */

"use strict";

import { $  }               from "../../core/dom.js";
import { postForm }         from "../../core/api.js";
import { showToast }        from "../../core/toast.js";
import { setButtonLoading } from "../../core/button.js";

/* ─────────────────────────────────────────────────────────
   DEFAULTS
───────────────────────────────────────────────────────── */

const DEFAULTS = {
  source:         "home",
  formType:       "contact",
  selectField:    "energyType",
  successMessage: "✓ Richiesta inviata! Ti risponderemo entro 24 ore.",
};

/* ─────────────────────────────────────────────────────────
   initContactForm
───────────────────────────────────────────────────────── */

/**
 * Initialise a contact form.
 * Safe to call multiple times on the same page with different configs.
 *
 * @param {object} config — see module JSDoc above
 */
export function initContactForm(config = {}) {
  const cfg = { ...DEFAULTS, ...config };

  const form       = document.getElementById(cfg.formId);
  const submitBtn  = document.getElementById(cfg.submitBtnId);

  if (!form) return;

  /* ── Scoped element helpers ────────────────────────────
     All queries are scoped to `form` so multiple instances
     on the same page never collide.
  ─────────────────────────────────────────────────────── */

  const get  = (sel) => form.querySelector(sel);

  // Phone toggle
  const phoneToggle     = get("[data-phone-toggle]") || get("[type='checkbox'][id$='phone-toggle']") || get("#phoneToggle") || get("#lcPhoneToggle");
  const phoneFieldWrap  = get("[data-phone-wrap]")   || get("#phoneFieldWrap") || get("#lcPhoneWrap");
  const phoneInput      = get("[name='phone']");
  const contactTimeRow  = get("[data-contact-time-row]") || get("#contactTimeRow") || get("#lcContactTimeRow");

  // Consent
  const consentBlock    = get("[data-consent-block]") || get(".consent-block");
  const consentChk      = get("[data-consent]") || get("[name='consent']") || get("#consentCheckbox") || get("#lcConsent");
  const consentError    = get("[data-consent-error]") || get(".consent-error") || get("#consentError") || get("#lcConsentError");

  /* ── Phone toggle ──────────────────────────────────── */

  phoneToggle?.addEventListener("change", () => {
    const on = phoneToggle.checked;
    phoneToggle.setAttribute("aria-checked", String(on));

    if (phoneFieldWrap)  phoneFieldWrap.style.display  = on ? ""    : "none";
    if (contactTimeRow)  contactTimeRow.style.display  = on ? "flex" : "none";
    if (phoneInput)      phoneInput.required            = on;
  });

  /* ── Consent — clear error on check ───────────────── */

  consentChk?.addEventListener("change", () => {
    if (consentChk.checked) {
      consentBlock?.classList.remove("error");
      consentError?.classList.remove("visible");
    }
  });

  /* ── Submit ────────────────────────────────────────── */

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    /* 1. Consent gate */
    if (!consentChk?.checked) {
      consentBlock?.classList.add("error");
      consentError?.classList.add("visible");
      consentBlock?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    /* 2. HTML5 validation */
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    /* 3. Honeypot guard */
    const honeypot = get("[name='company']");
    if (honeypot?.value) return;

    /* 4. Build payload */
    const payload = {
      source:      cfg.source,
      formType:    cfg.formType,
      category:    cfg.selectField && form[cfg.selectField]
                    ? (form[cfg.selectField].value || "")
                    : "",
      firstname:   form.firstname?.value?.trim()   || "",
      lastname:    form.lastname?.value?.trim()    || "",
      email:       form.email?.value?.trim()       || "",
      phone:       form.phone?.value?.trim()       || "",
      contactTime: form.contactTime?.value         || "",
      messageForm: form.message?.value?.trim()     || "",
      consent:     "SI",
    };

    /* 5. Submit — postForm() always POSTs to /api/form/submit;
          formController.js routes by payload.formType. */
    setButtonLoading(submitBtn, true);

    const result = await postForm(payload);

    if (result.success) {
      showToast(cfg.successMessage, "success");
      _onSuccess(form, submitBtn, phoneFieldWrap, contactTimeRow);
    } else {
      showToast(result.message || "Errore durante l'invio. Riprova.", "error");
      setButtonLoading(submitBtn, false);
    }
  });
}

/* ─────────────────────────────────────────────────────────
   INTERNAL — success state
───────────────────────────────────────────────────────── */

function _onSuccess(form, submitBtn, phoneFieldWrap, contactTimeRow) {
  setButtonLoading(submitBtn, false, "✓ Inviato");

  if (submitBtn) {
    submitBtn.style.background = "var(--green)";
    submitBtn.style.color      = "#fff";
    submitBtn.disabled         = true;
  }

  form.reset();

  // Hide optional rows that were shown before submit
  if (phoneFieldWrap) phoneFieldWrap.style.display = "none";
  if (contactTimeRow) contactTimeRow.style.display = "none";
}