"use strict";
/**
 * admin/drawers.js
 *
 * Slide-over drawer components for the admin console.
 *
 * Partner drawer  — create / edit / approve (Section 9B)
 * Customer drawer — create / edit            (Section 9D)
 * Offer drawer    — edit                     (Section 9E)
 *
 * Each drawer is self-contained: DOM references, open/close helpers,
 * toggle logic, and submit handlers all live here.
 *
 * Imports from ui.js: $, esc, Api, setLoading, showFeedback, showToast,
 *                     showConfirm, renderActionCell, wireActionMenus
 * Calls back to modules.js: loadPartners, loadPartnerRequests,
 *                            loadCustomers, loadOffers, loadStats
 *   (passed in at wire-time, not imported, to avoid circular deps)
 */

import {
  $, esc,
  Api,
  setLoading, showFeedback, showToast,
} from "./ui.js";

// Back-references to module loaders — set by admin.js after both
// modules.js and drawers.js are initialised, avoiding circular imports.
let _loadPartners        = () => {};
let _loadPartnerRequests = () => {};
let _loadCustomers       = () => {};
let _loadOffers          = () => {};
let _loadStats           = () => {};

export function setDrawerLoaders(loaders) {
  _loadPartners        = loaders.loadPartners;
  _loadPartnerRequests = loaders.loadPartnerRequests;
  _loadCustomers       = loaders.loadCustomers;
  _loadOffers          = loaders.loadOffers;
  _loadStats           = loaders.loadStats;
}

/*
   SECTION 9B — PARTNER FORM DRAWER (CREATE / EDIT / APPROVE)

   Single drawer component for three flows:
     - Create: openCreatePartnerDrawer()
         Password temporanea visible
         Stato (active toggle) hidden
     - Edit:   openEditPartnerDrawer(partnerId)
         Password temporanea hidden
         Stato visible, fields pre-filled via
         GET /admin/partners/:id
     - Approve: openApproveRequestDrawer(requestObj)
         Password temporanea visible
         Stato hidden
         All request fields pre-filled from the
         in-memory request object (no extra API call)

   Partner ID is NEVER entered by the admin.
   It is generated server-side by partnerLoyaltyService.createPartner()
   from the business name + a random 4-char hex suffix.
═══════════════════════════════════════════════════════════ */

const PARTNER_CATEGORIES = ["ristorante", "bar", "palestra", "negozio", "servizi", "beauty", "altro"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const pfDrawerBackdrop = $("#admPartnerDrawerBackdrop");
const pfClose          = $("#admPartnerDrawerClose");
const pfCancelBtn      = $("#pfCancelBtn");
const pfForm           = $("#partnerForm");
const pfSubmitBtn      = $("#pfSubmitBtn");
const pfSubmitLabel    = $("#pfSubmitLabel");
const pfTitle          = $("#admPartnerDrawerTitle");
const pfSub            = $("#admPartnerDrawerSub");
const pfPasswordField  = $("#pfPasswordField");
const pfStatusField    = $("#pfStatusField");
const pfName           = $("#pfName");
const pfStatusToggle   = $("#pfStatusToggle");
const pfStatusLabel    = $("#pfStatusLabel");
const pfErrorEl        = $("#partnerFormError");
const pfSuccessEl      = $("#partnerFormSuccess");

let pfMode               = "create"; // 'create' | 'edit' | 'approve'
let pfEditingId          = null;
let pfActiveState        = true;
let _pfApprovalRequestId = null;

/** Set the active/suspended toggle visual + internal state */
export function setPartnerToggle(active) {
  pfActiveState = active;
  pfStatusToggle?.setAttribute("aria-checked", String(active));
  pfStatusToggle?.classList.toggle("on", active);
  if (pfStatusLabel) pfStatusLabel.textContent = active ? "Attivo" : "Sospeso";
}

/** Reset form fields + feedback */
function resetPartnerForm() {
  pfForm?.reset();
  setPartnerToggle(true);
  showFeedback(pfErrorEl, pfSuccessEl, "none");
}

/** Fill all form fields from a data object */
export function fillPartnerForm(d = {}) {
  const set = (id, val) => {
    const el = $(`#${id}`);
    if (el) el.value = val || "";
  };
  set("pfName",             d.name             || d.businessName || "");
  set("pfLegalName",        d.legalName        || "");
  set("pfVat",              d.vatNumber        || "");
  set("pfCategory",         d.category         || "");
  set("pfEmail",            d.email            || "");
  set("pfPhone",            d.phone            || "");
  set("pfWebsite",          d.website          || "");
  set("pfAddress",          d.address          || "");
  set("pfCity",             d.city             || "");
  set("pfPostalCode",       d.postalCode       || "");
  set("pfDescription",      d.description      || "");
  set("pfOfferDescription", d.offerDescription || d.description || "");
  set("pfNotes",            d.notes            || "");
}

export function openPartnerDrawer() {
  pfDrawerBackdrop?.classList.add("open");
  document.body.style.overflow = "hidden";
}

export function closePartnerDrawer() {
  pfDrawerBackdrop?.classList.remove("open");
  document.body.style.overflow = "";
}

// Toggle click
pfStatusToggle?.addEventListener("click", () => setPartnerToggle(!pfActiveState));

// Close handlers
pfClose?.addEventListener("click", closePartnerDrawer);
pfCancelBtn?.addEventListener("click", closePartnerDrawer);
pfDrawerBackdrop?.addEventListener("click", (e) => {
  if (e.target === pfDrawerBackdrop) closePartnerDrawer();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && pfDrawerBackdrop?.classList.contains("open")) {
    closePartnerDrawer();
  }
});

/**
 * Open the drawer in CREATE mode.
 * Password temporanea visible. Stato hidden. Form empty.
 */
export function openCreatePartnerDrawer() {
  pfMode               = "create";
  pfEditingId          = null;
  _pfApprovalRequestId = null;
  resetPartnerForm();

  if (pfTitle)       pfTitle.textContent       = "Nuovo partner";
  if (pfSub)         pfSub.textContent         = "Crea un nuovo partner per l'Energy Club";
  if (pfSubmitLabel) pfSubmitLabel.textContent = "Crea partner";

  if (pfPasswordField) pfPasswordField.style.display = "";
  if (pfStatusField)   pfStatusField.style.display   = "none";

  openPartnerDrawer();
  pfName?.focus();
}

/**
 * Open the drawer in EDIT mode.
 * Fetches full record (GET /admin/partners/:id).
 * Password field hidden. Stato toggle visible.
 *
 * @param {string} partnerId
 */
export async function openEditPartnerDrawer(partnerId) {
  pfMode               = "edit";
  pfEditingId          = partnerId;
  _pfApprovalRequestId = null;
  resetPartnerForm();

  if (pfTitle)       pfTitle.textContent       = "Modifica partner";
  if (pfSub)         pfSub.textContent         = `ID: ${partnerId}`;
  if (pfSubmitLabel) pfSubmitLabel.textContent = "Salva modifiche";

  if (pfPasswordField) pfPasswordField.style.display = "none";
  if (pfStatusField)   pfStatusField.style.display   = "";

  openPartnerDrawer();

  setLoading(pfSubmitBtn, true);
  if (pfSubmitBtn) pfSubmitBtn.disabled = true;

  try {
    const res = await Api.get(`/partners/${encodeURIComponent(partnerId)}`);
    const p   = res?.data;

    if (!p) {
      showFeedback(pfErrorEl, pfSuccessEl, "error", "Impossibile caricare il partner.");
      return;
    }

    fillPartnerForm(p);
    setPartnerToggle(Boolean(p.active));

  } catch {
    showFeedback(pfErrorEl, pfSuccessEl, "error", "Errore di connessione. Riprova.");
  } finally {
    setLoading(pfSubmitBtn, false);
    if (pfSubmitBtn) pfSubmitBtn.disabled = false;
  }
}

/**
 * Open the drawer in APPROVE mode.
 * Pre-fills ALL fields from the in-memory request object —
 * no additional API call needed; the object is already in
 * memory from the loadPartnerRequests() response.
 * Password field visible (required to create the partner account).
 * Stato hidden (approved partners are always active).
 *
 * @param {object} requestObj — the full partner request row from the API
 */
export function openApproveRequestDrawer(requestObj) {
  pfMode               = "approve";
  pfEditingId          = null;
  _pfApprovalRequestId = requestObj.id;
  resetPartnerForm();

  if (pfTitle)       pfTitle.textContent       = "Approva richiesta partner";
  if (pfSub)         pfSub.textContent         = `Richiesta di: ${requestObj.businessName}`;
  if (pfSubmitLabel) pfSubmitLabel.textContent = "Approva e crea partner";

  if (pfPasswordField) pfPasswordField.style.display = "";
  if (pfStatusField)   pfStatusField.style.display   = "none";

  // Pre-fill from request — offerDescription maps from request.description
  fillPartnerForm({
    businessName:     requestObj.businessName,
    vatNumber:        requestObj.vatNumber,
    category:         requestObj.category,
    email:            requestObj.email,
    phone:            requestObj.phone,
    description:      requestObj.description, // fillPartnerForm maps this to offerDescription too
  });

  openPartnerDrawer();
  // Focus the password field — it's the only thing the admin must fill
  $("#pfTempPassword")?.focus();
}

// "Nuovo partner" button (page header)
$("#admTogglePartnerForm")?.addEventListener("click", openCreatePartnerDrawer);

// Submit
pfForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showFeedback(pfErrorEl, pfSuccessEl, "none");

  const payload = {
    name:             $("#pfName")?.value.trim(),
    legalName:        $("#pfLegalName")?.value.trim(),
    vatNumber:        $("#pfVat")?.value.trim(),
    category:         $("#pfCategory")?.value,
    email:            $("#pfEmail")?.value.trim(),
    phone:            $("#pfPhone")?.value.trim(),
    website:          $("#pfWebsite")?.value.trim(),
    address:          $("#pfAddress")?.value.trim(),
    city:             $("#pfCity")?.value.trim(),
    postalCode:       $("#pfPostalCode")?.value.trim(),
    description:      $("#pfDescription")?.value.trim(),
    offerDescription: $("#pfOfferDescription")?.value.trim(),
    notes:            $("#pfNotes")?.value.trim(),
  };

  // Validation shared across create + approve
  if (!payload.name) {
    showFeedback(pfErrorEl, pfSuccessEl, "error", "Il nome attività è obbligatorio.");
    pfName?.focus();
    return;
  }

  if (!payload.category || !PARTNER_CATEGORIES.includes(payload.category)) {
    showFeedback(pfErrorEl, pfSuccessEl, "error", "Seleziona una categoria valida.");
    $("#pfCategory")?.focus();
    return;
  }

  if (payload.email && !EMAIL_RE.test(payload.email)) {
    showFeedback(pfErrorEl, pfSuccessEl, "error", "Email non valida.");
    $("#pfEmail")?.focus();
    return;
  }

  setLoading(pfSubmitBtn, true);

  try {
    let data;

    if (pfMode === "create") {
      const tempPassword = $("#pfTempPassword")?.value;

      if (!tempPassword || tempPassword.length < 8) {
        showFeedback(pfErrorEl, pfSuccessEl, "error", "La password temporanea deve avere almeno 8 caratteri.");
        $("#pfTempPassword")?.focus();
        return;
      }

      // Partner ID is generated server-side — not sent by the frontend.
      data = await Api.post("/partners", { tempPassword, ...payload });

    } else if (pfMode === "approve") {
      const tempPassword = $("#pfTempPassword")?.value;

      if (!tempPassword || tempPassword.length < 8) {
        showFeedback(pfErrorEl, pfSuccessEl, "error", "La password temporanea deve avere almeno 8 caratteri.");
        $("#pfTempPassword")?.focus();
        return;
      }

      // Partner ID is generated server-side by the approval service.
      data = await Api.post(
        `/partner-requests/${encodeURIComponent(_pfApprovalRequestId)}/approve`,
        { tempPassword, ...payload }
      );

    } else {
      // Edit
      payload.active = pfActiveState;
      data = await Api.patch(`/partners/${encodeURIComponent(pfEditingId)}`, payload);
    }

    if (data?.success) {
      const successMsg =
        pfMode === "create"
          ? `Partner "${esc(payload.name)}" creato. Dovrà impostare la password al primo accesso.`
          : pfMode === "approve"
            ? `Richiesta approvata. Partner "${esc(payload.name)}" creato con successo.`
            : "Modifiche salvate con successo.";

      showFeedback(pfErrorEl, pfSuccessEl, "success", successMsg);

      const reloads = [loadStats(), loadPartners()];
      if (pfMode === "approve") reloads.push(loadPartnerRequests());
      await Promise.all(reloads);

      setTimeout(closePartnerDrawer, 900);

    } else {
      showFeedback(pfErrorEl, pfSuccessEl, "error", data?.message || "Si è verificato un errore. Riprova.");
    }
  } catch {
    showFeedback(pfErrorEl, pfSuccessEl, "error", "Errore di connessione. Riprova.");
  } finally {
    setLoading(pfSubmitBtn, false);
  }
});


/* ═══════════════════════════════════════════════════════════


   SECTION 9D — CUSTOMER DRAWER (CREATE + EDIT)
   Same .adm-drawer-* CSS shell as the partner drawer.
   Supports two modes via _cfMode:
     "create" — form empty, identifier editable, password required
     "edit"   — pre-filled from GET /admin/customers/:id,
                identifier read-only, password hidden
═══════════════════════════════════════════════════════════ */

const cfDrawerBackdrop  = $("#admCustomerDrawerBackdrop");
const cfClose           = $("#admCustomerDrawerClose");
const cfCancelBtn       = $("#cfCancelBtn");
const cfForm            = $("#customerForm");
const cfSubmitBtn       = $("#cfSubmitBtn");
const cfSubmitLabel     = $("#cfSubmitLabel");
const cfTitle           = $("#admCustomerDrawerTitle");
const cfSub             = $("#admCustomerDrawerSub");
const cfErrorEl         = $("#customerFormError");
const cfSuccessEl       = $("#customerFormSuccess");
const cfNameInput       = $("#cfName");
const cfIdentifier      = $("#cfIdentifier");
const cfIdentifierHint  = $("#cfIdentifierHint");
const cfPasswordField   = $("#cfPasswordField");
const cfPasswordInput   = $("#cfPassword");

let _cfMode      = "edit";  // "create" | "edit"
let _cfEditingId = null;

export function openCustomerDrawer() {
  cfDrawerBackdrop?.classList.add("open");
  document.body.style.overflow = "hidden";
}

export function closeCustomerDrawer() {
  cfDrawerBackdrop?.classList.remove("open");
  document.body.style.overflow = "";
}

cfClose?.addEventListener("click", closeCustomerDrawer);
cfCancelBtn?.addEventListener("click", closeCustomerDrawer);
cfDrawerBackdrop?.addEventListener("click", (e) => {
  if (e.target === cfDrawerBackdrop) closeCustomerDrawer();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && cfDrawerBackdrop?.classList.contains("open")) {
    closeCustomerDrawer();
  }
});

/** Wire "Nuovo Cliente" button */
$("#admNewCustomerBtn")?.addEventListener("click", openCreateCustomerDrawer);

/**
 * Open the drawer in CREATE mode.
 * Identifier editable + required; password field visible.
 */
export function openCreateCustomerDrawer() {
  _cfMode      = "create";
  _cfEditingId = null;
  cfForm?.reset();
  showFeedback(cfErrorEl, cfSuccessEl, "none");

  if (cfTitle)       cfTitle.textContent       = "Nuovo cliente";
  if (cfSub)         cfSub.textContent         = "Crea un nuovo cliente per l'Energy Club";
  if (cfSubmitLabel) cfSubmitLabel.textContent = "Crea cliente";

  // Show password field + editable identifier
  if (cfPasswordField) cfPasswordField.style.display = "";
  if (cfIdentifier) {
    cfIdentifier.disabled = false;
    cfIdentifier.style.opacity = "";
    cfIdentifier.style.cursor  = "";
    cfIdentifier.value = "";
  }
  if (cfIdentifierHint) cfIdentifierHint.style.display = "none";

  openCustomerDrawer();
  cfNameInput?.focus();
}

/**
 * Open the drawer in EDIT mode for an existing customer.
 * Fetches the full record via GET /admin/customers/:id.
 * Identifier shown read-only; password field hidden.
 *
 * @param {string} customerId
 */
export async function openEditCustomerDrawer(customerId) {
  _cfMode      = "edit";
  _cfEditingId = customerId;
  cfForm?.reset();
  showFeedback(cfErrorEl, cfSuccessEl, "none");

  if (cfTitle)       cfTitle.textContent       = "Modifica cliente";
  if (cfSub)         cfSub.textContent         = "";
  if (cfSubmitLabel) cfSubmitLabel.textContent = "Salva modifiche";

  // Hide password field + lock identifier
  if (cfPasswordField) cfPasswordField.style.display = "none";
  if (cfIdentifier) {
    cfIdentifier.disabled      = true;
    cfIdentifier.style.opacity = "0.6";
    cfIdentifier.style.cursor  = "not-allowed";
  }
  if (cfIdentifierHint) cfIdentifierHint.style.display = "";

  openCustomerDrawer();
  setLoading(cfSubmitBtn, true);
  if (cfSubmitBtn) cfSubmitBtn.disabled = true;

  try {
    const res = await Api.get(`/customers/${encodeURIComponent(customerId)}`);
    const c   = res?.data;

    if (!c) {
      showFeedback(cfErrorEl, cfSuccessEl, "error", "Impossibile caricare il cliente.");
      return;
    }

    if (cfNameInput)   cfNameInput.value  = c.full_name  || "";
    if (cfIdentifier)  cfIdentifier.value = c.identifier || "";
    if (cfSub)         cfSub.textContent  = c.identifier || "";

  } catch {
    showFeedback(cfErrorEl, cfSuccessEl, "error", "Errore di connessione. Riprova.");
  } finally {
    setLoading(cfSubmitBtn, false);
    if (cfSubmitBtn) cfSubmitBtn.disabled = false;
    cfNameInput?.focus();
  }
}

cfForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showFeedback(cfErrorEl, cfSuccessEl, "none");

  const full_name = cfNameInput?.value.trim();
  if (!full_name) {
    showFeedback(cfErrorEl, cfSuccessEl, "error", "Il nome è obbligatorio.");
    cfNameInput?.focus();
    return;
  }

  setLoading(cfSubmitBtn, true);

  try {
    let data;

    if (_cfMode === "create") {
      const identifier = cfIdentifier?.value.trim();
      const password   = cfPasswordInput?.value;

      if (!identifier) {
        showFeedback(cfErrorEl, cfSuccessEl, "error", "Email o numero di telefono obbligatorio.");
        cfIdentifier?.focus();
        return;
      }
      if (!password || password.length < 8) {
        showFeedback(cfErrorEl, cfSuccessEl, "error", "La password deve avere almeno 8 caratteri.");
        cfPasswordInput?.focus();
        return;
      }

      data = await Api.post("/customers", { full_name, identifier, password });

    } else {
      data = await Api.patch(
        `/customers/${encodeURIComponent(_cfEditingId)}`,
        { full_name }
      );
    }

    if (data?.success) {
      const msg = _cfMode === "create"
        ? `Cliente "${esc(full_name)}" creato con successo.`
        : "Modifiche salvate con successo.";
      showFeedback(cfErrorEl, cfSuccessEl, "success", msg);
      await Promise.all([_loadCustomers(), _loadStats()]);
      setTimeout(closeCustomerDrawer, 900);
    } else {
      showFeedback(cfErrorEl, cfSuccessEl, "error", data?.message || "Errore durante il salvataggio.");
    }
  } catch {
    showFeedback(cfErrorEl, cfSuccessEl, "error", "Errore di connessione. Riprova.");
  } finally {
    setLoading(cfSubmitBtn, false);
  }
});


/* ═══════════════════════════════════════════════════════════
   SECTION 9E — OFFER EDIT DRAWER
   Edit-only (create has its own existing modal).
   Fields: title, description, status segmented control.
   Partner shown read-only.
   Status uses a segmented control (Attiva / Sospesa) —
   more explicit than a toggle, scales if a third status
   (e.g. Archiviata) is added later without UI restructuring.
═══════════════════════════════════════════════════════════ */

const ofDrawerBackdrop = $("#admOfferDrawerBackdrop");
const ofClose          = $("#admOfferDrawerClose");
const ofCancelBtn      = $("#ofCancelBtn");
const ofForm           = $("#offerForm");
const ofSubmitBtn      = $("#ofSubmitBtn");
const ofTitle          = $("#admOfferDrawerTitle");
const ofSub            = $("#admOfferDrawerSub");
const ofErrorEl        = $("#offerFormError");
const ofSuccessEl      = $("#offerFormSuccess");
const ofTitleInput     = $("#ofTitle");
const ofDescInput      = $("#ofDescription");
const ofPartnerInput   = $("#ofPartner");
const ofStatusSegment  = $("#ofStatusSegment");

let _ofEditingId = null;

/**
 * Get current status from the segmented control.
 * Returns true (active) when data-value === "active".
 */
function getOfferActiveState() {
  return ofStatusSegment?.dataset.value === "active";
}

/**
 * Set the segmented control to the given state.
 * Updates data-value on the container and toggles the
 * .adm-segment-btn--active class on the matching button.
 */
function setOfferSegment(active) {
  if (!ofStatusSegment) return;
  const value = active ? "active" : "inactive";
  ofStatusSegment.dataset.value = value;

  ofStatusSegment.querySelectorAll(".adm-segment-btn").forEach((btn) => {
    const isSelected = btn.dataset.segmentValue === value;
    btn.classList.toggle("adm-segment-btn--active", isSelected);
    btn.setAttribute("aria-pressed", String(isSelected));
  });
}

// Wire segment buttons
ofStatusSegment?.querySelectorAll(".adm-segment-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    setOfferSegment(btn.dataset.segmentValue === "active");
  });
});

export function openOfferDrawer() {
  ofDrawerBackdrop?.classList.add("open");
  document.body.style.overflow = "hidden";
}

export function closeOfferDrawer() {
  ofDrawerBackdrop?.classList.remove("open");
  document.body.style.overflow = "";
}

ofClose?.addEventListener("click", closeOfferDrawer);
ofCancelBtn?.addEventListener("click", closeOfferDrawer);
ofDrawerBackdrop?.addEventListener("click", (e) => {
  if (e.target === ofDrawerBackdrop) closeOfferDrawer();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && ofDrawerBackdrop?.classList.contains("open")) {
    closeOfferDrawer();
  }
});

/**
 * Open the offer edit drawer for a given offer ID.
 * Fetches the full record via GET /admin/offers/:id
 * then pre-fills the form.
 *
 * @param {string} offerId
 */
export async function openEditOfferDrawer(offerId) {
  _ofEditingId = offerId;

  if (ofTitle) ofTitle.textContent = "Modifica offerta";
  if (ofSub)   ofSub.textContent   = "";
  showFeedback(ofErrorEl, ofSuccessEl, "none");
  ofForm?.reset();
  setOfferSegment(true); // default before data loads

  openOfferDrawer();
  setLoading(ofSubmitBtn, true);
  if (ofSubmitBtn) ofSubmitBtn.disabled = true;

  try {
    const res = await Api.get(`/offers/${encodeURIComponent(offerId)}`);
    const o   = res?.data;

    if (!o) {
      showFeedback(ofErrorEl, ofSuccessEl, "error", "Impossibile caricare l'offerta.");
      return;
    }

    if (ofTitleInput)   ofTitleInput.value   = o.title       || "";
    if (ofDescInput)    ofDescInput.value    = o.description || "";
    if (ofPartnerInput) ofPartnerInput.value = o.partnerId   || "";
    if (ofSub)          ofSub.textContent   = o.title       || "";
    setOfferSegment(Boolean(o.active));

  } catch {
    showFeedback(ofErrorEl, ofSuccessEl, "error", "Errore di connessione. Riprova.");
  } finally {
    setLoading(ofSubmitBtn, false);
    if (ofSubmitBtn) ofSubmitBtn.disabled = false;
    ofTitleInput?.focus();
  }
}

ofForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  showFeedback(ofErrorEl, ofSuccessEl, "none");

  const title = ofTitleInput?.value.trim();
  if (!title) {
    showFeedback(ofErrorEl, ofSuccessEl, "error", "Il titolo è obbligatorio.");
    ofTitleInput?.focus();
    return;
  }

  setLoading(ofSubmitBtn, true);

  try {
    const data = await Api.patch(
      `/offers/${encodeURIComponent(_ofEditingId)}`,
      {
        title,
        description: ofDescInput?.value.trim() || "",
        active:      getOfferActiveState(),
      }
    );

    if (data?.success) {
      showFeedback(ofErrorEl, ofSuccessEl, "success", "Offerta aggiornata con successo.");
      await Promise.all([_loadOffers(), _loadStats()]);
      setTimeout(closeOfferDrawer, 900);
    } else {
      showFeedback(ofErrorEl, ofSuccessEl, "error", data?.message || "Errore durante il salvataggio.");
    }
  } catch {
    showFeedback(ofErrorEl, ofSuccessEl, "error", "Errore di connessione. Riprova.");
  } finally {
    setLoading(ofSubmitBtn, false);
  }
});


/* ═══════════════════════════════════════════════════════════
   SECTION 10 — OFFERS MODULE
*/