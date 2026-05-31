/**
 * js/features/loyalty/admin/admin.js
 * Admin panel — login + full dashboard.
 *
 * Features:
 *   - Inline session check (HTML guard sets window.__adminAuthenticated)
 *   - Login form shown only if unauthenticated
 *   - Dashboard shown only if authenticated
 *   - Tab system: Customers / Partners / Offers / Redemptions
 *   - Partner creation with temp password + mustChangePassword flag
 *   - Partner active/suspend toggle
 *   - Offer creation
 *   - All tables with safe HTML escaping (XSS prevention)
 *   - X-Requested-With on all state-mutating requests (CSRF)
 *   - All strings in Italian
 */

import { $, $$ } from "../../../core/dom.js";
import { setLoading } from "../../../core/loyaltyUtils.js";

/* ─────────────────────────────────────────────────────────────
   DOM REFS — dashboard
───────────────────────────────────────────────────────────── */
const adminDashboard     = $("#adminDashboard");
const adminTopbarActions = $("#adminTopbarActions");
const logoutBtn          = $("#logoutBtn");

/* ─────────────────────────────────────────────────────────────
   DOM REFS — stats
───────────────────────────────────────────────────────────── */
const statCustomers   = $("#statCustomers");
const statRedemptions = $("#statRedemptions");
const statOffers      = $("#statOffers");
const statPartners    = $("#statPartners");

/* ─────────────────────────────────────────────────────────────
   DOM REFS — tabs
───────────────────────────────────────────────────────────── */
const tabBtns = $$(".loyalty-admin-tab");
const tabPanels = {
  customers:   $("#tabCustomers"),
  partners:    $("#tabPartners"),
  offers:      $("#tabOffers"),
  redemptions: $("#tabRedemptions"),
};

/* ─────────────────────────────────────────────────────────────
   DOM REFS — tables
───────────────────────────────────────────────────────────── */
const customersBody   = $("#customersTableBody");
const partnersBody    = $("#partnersTableBody");
const offersBody      = $("#offersTableBody");
const redemptionsBody = $("#redemptionsTableBody");

/* ─────────────────────────────────────────────────────────────
   DOM REFS — partner form
───────────────────────────────────────────────────────────── */
const createPartnerForm    = $("#createPartnerForm");
const newPartnerIdEl       = $("#newPartnerId");
const partnerNameEl        = $("#partnerName");
const partnerCategoryEl    = $("#partnerCategory");
const partnerAddressEl     = $("#partnerAddress");
const partnerTempPassEl    = $("#partnerTempPassword");
const createPartnerBtn     = $("#createPartnerBtn");
const partnerError         = $("#partnerError");
const partnerErrorText     = $("#partnerErrorText");
const partnerSuccess       = $("#partnerSuccess");
const partnerSuccessText   = $("#partnerSuccessText");

/* ─────────────────────────────────────────────────────────────
   DOM REFS — offer form
───────────────────────────────────────────────────────────── */
const addOfferForm    = $("#addOfferForm");
const offerTitleEl    = $("#offerTitle");
const offerDescEl     = $("#offerDescription");
const offerPartnerEl  = $("#offerPartner");
const addOfferBtn     = $("#addOfferBtn");
const offerError      = $("#offerError");
const offerErrorText  = $("#offerErrorText");
const offerSuccess    = $("#offerSuccess");

/* ─────────────────────────────────────────────────────────────
   STATE
───────────────────────────────────────────────────────────── */
let _activeTab = "customers";

/* ─────────────────────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────────────────────── */
function _esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function _fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("it-IT", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  } catch { return iso; }
}

function _badge(active) {
  return active
    ? `<span class="loyalty-badge loyalty-badge--active">Attivo</span>`
    : `<span class="loyalty-badge loyalty-badge--inactive">Sospeso</span>`;
}

function _emptyRow(colspan, msg = "Nessun dato disponibile.") {
  return `<tr><td colspan="${colspan}" style="text-align:center;padding:28px;color:var(--text-secondary);">${_esc(msg)}</td></tr>`;
}

function _showFeedback(errEl, errTextEl, successEl, successTextEl, isSuccess, msg) {
  if (isSuccess) {
    if (errEl) errEl.classList.remove("visible");
    if (successEl) {
      if (successTextEl) successTextEl.textContent = msg;
      successEl.classList.add("visible");
    }
  } else {
    if (successEl) successEl.classList.remove("visible");
    if (errEl) {
      if (errTextEl) errTextEl.textContent = msg;
      errEl.classList.add("visible");
    }
  }
}

/* ── Logout ── */
logoutBtn.addEventListener("click", async () => {
  try {
    await fetch("/api/loyalty/admin/logout", {
      method:      "POST",
      credentials: "same-origin",
      headers:     { "X-Requested-With": "XMLHttpRequest" },
    });
  } catch { /* best-effort */ }
  window.location.replace("/loyalty/admin/login.html");
});

/* ─────────────────────────────────────────────────────────────
   STATS
───────────────────────────────────────────────────────────── */
async function _loadStats() {
  try {
    const [cRes, rRes, oRes, pRes] = await Promise.all([
      fetch("/api/loyalty/admin/customers",   { credentials: "same-origin" }),
      fetch("/api/loyalty/admin/redemptions", { credentials: "same-origin" }),
      fetch("/api/loyalty/admin/offers",      { credentials: "same-origin" }),
      fetch("/api/loyalty/admin/partners",    { credentials: "same-origin" }),
    ]);

    const [cData, rData, oData, pData] = await Promise.all([
      cRes.json(), rRes.json(), oRes.json(), pRes.json(),
    ]);

    if (statCustomers)   statCustomers.textContent   = (cData.data || []).length;
    if (statRedemptions) statRedemptions.textContent = (rData.data || []).length;
    if (statOffers)      statOffers.textContent      = (oData.data || []).filter((o) => o.active).length;
    if (statPartners)    statPartners.textContent    = (pData.data || []).filter((p) => p.active).length;
  } catch {
    [statCustomers, statRedemptions, statOffers, statPartners]
      .forEach((el) => { if (el) el.textContent = "—"; });
  }
}

/* ─────────────────────────────────────────────────────────────
   DATA LOADERS
───────────────────────────────────────────────────────────── */
async function _loadCustomers() {
  if (customersBody) customersBody.innerHTML = _emptyRow(6, "Caricamento...");
  try {
    const res  = await fetch("/api/loyalty/admin/customers", { credentials: "same-origin" });
    if (res.status === 401) { showLoginPanel(); return; }
    const data = await res.json();
    const rows = data.data || [];

    if (!rows.length) {
      customersBody.innerHTML = _emptyRow(6, "Nessun cliente registrato.");
      return;
    }

    customersBody.innerHTML = rows.map((c) => `
      <tr>
        <td style="font-family:var(--font-display,monospace);font-size:0.7rem;color:var(--text-secondary);">${_esc(c.id)}</td>
        <td style="font-weight:600;">${_esc(c.full_name)}</td>
        <td>${_esc(c.identifier)}</td>
        <td><span class="loyalty-badge loyalty-badge--pending">${_esc(c.identifierType || "—")}</span></td>
        <td>${_badge(c.active)}</td>
        <td style="color:var(--text-secondary);font-size:0.8rem;">${_fmtDate(c.createdAt)}</td>
      </tr>
    `).join("");
  } catch {
    if (customersBody) customersBody.innerHTML = _emptyRow(6, "Errore nel caricamento clienti.");
  }
}

async function _loadPartners() {
  if (partnersBody) partnersBody.innerHTML = _emptyRow(7, "Caricamento...");
  try {
    const res  = await fetch("/api/loyalty/admin/partners", { credentials: "same-origin" });
    if (res.status === 401) { showLoginPanel(); return; }
    const data = await res.json();
    const rows = data.data || [];

    if (!rows.length) {
      partnersBody.innerHTML = _emptyRow(7, "Nessun partner creato.");
      return;
    }

    partnersBody.innerHTML = rows.map((p) => `
      <tr>
        <td style="font-family:var(--font-display,monospace);font-size:0.72rem;color:var(--text-secondary);">${_esc(p.id)}</td>
        <td style="font-weight:600;">${_esc(p.name)}</td>
        <td>${_esc(p.category || "—")}</td>
        <td style="font-size:0.82rem;color:var(--text-secondary);">${_esc(p.address || "—")}</td>
        <td>${_badge(p.active)}</td>
        <td>
          ${p.mustChangePassword
            ? `<span class="loyalty-badge loyalty-badge--pending">Da impostare</span>`
            : `<span class="loyalty-badge loyalty-badge--active">Impostata</span>`}
        </td>
        <td>
          ${p.active
            ? `<button class="loyalty-table-action loyalty-table-action--danger"
                data-partner-id="${_esc(p.id)}" data-action="suspend"
                aria-label="Sospendi partner ${_esc(p.name)}">
                Sospendi
               </button>`
            : `<button class="loyalty-table-action loyalty-table-action--success"
                data-partner-id="${_esc(p.id)}" data-action="activate"
                aria-label="Attiva partner ${_esc(p.name)}">
                Attiva
               </button>`}
        </td>
      </tr>
    `).join("");

    /* Bind action buttons */
    partnersBody.querySelectorAll("[data-partner-id]").forEach((btn) => {
      btn.addEventListener("click", () => _togglePartnerActive(
        btn.dataset.partnerId,
        btn.dataset.action === "activate"
      ));
    });

  } catch {
    if (partnersBody) partnersBody.innerHTML = _emptyRow(7, "Errore nel caricamento partner.");
  }
}

async function _loadOffers() {
  if (offersBody) offersBody.innerHTML = _emptyRow(6, "Caricamento...");
  try {
    const res  = await fetch("/api/loyalty/admin/offers", { credentials: "same-origin" });
    if (res.status === 401) { showLoginPanel(); return; }
    const data = await res.json();
    const rows = data.data || [];

    if (!rows.length) {
      offersBody.innerHTML = _emptyRow(6, "Nessuna offerta creata.");
      return;
    }

    offersBody.innerHTML = rows.map((o) => `
      <tr>
        <td style="font-family:var(--font-display,monospace);font-size:0.7rem;color:var(--text-secondary);">${_esc(o.id)}</td>
        <td style="font-weight:600;">${_esc(o.title)}</td>
        <td style="font-size:0.82rem;">${_esc(o.description || "—")}</td>
        <td style="font-size:0.82rem;">${_esc(o.partnerId || "Globale")}</td>
        <td>${_badge(o.active)}</td>
        <td style="color:var(--text-secondary);font-size:0.8rem;">${_fmtDate(o.createdAt)}</td>
      </tr>
    `).join("");
  } catch {
    if (offersBody) offersBody.innerHTML = _emptyRow(6, "Errore nel caricamento offerte.");
  }
}

async function _loadRedemptions() {
  if (redemptionsBody) redemptionsBody.innerHTML = _emptyRow(5, "Caricamento...");
  try {
    const res  = await fetch("/api/loyalty/admin/redemptions", { credentials: "same-origin" });
    if (res.status === 401) { showLoginPanel(); return; }
    const data = await res.json();
    const rows = data.data || [];

    if (!rows.length) {
      redemptionsBody.innerHTML = _emptyRow(5, "Nessun utilizzo registrato.");
      return;
    }

    redemptionsBody.innerHTML = rows.map((r) => `
      <tr>
        <td style="font-family:var(--font-display,monospace);font-size:0.7rem;color:var(--text-secondary);">${_esc(r.id)}</td>
        <td>${_esc(r.customerId)}</td>
        <td>${_esc(r.partnerId)}</td>
        <td>${_esc(r.offerId)}</td>
        <td style="color:var(--text-secondary);font-size:0.8rem;">${_fmtDate(r.createdAt)}</td>
      </tr>
    `).join("");
  } catch {
    if (redemptionsBody) redemptionsBody.innerHTML = _emptyRow(5, "Errore nel caricamento utilizzi.");
  }
}

/* ─────────────────────────────────────────────────────────────
   PARTNER ACTIVE TOGGLE
───────────────────────────────────────────────────────────── */
async function _togglePartnerActive(partnerId, active) {
  try {
    const res = await fetch(`/api/loyalty/admin/partners/${encodeURIComponent(partnerId)}/active`, {
      method:      "PATCH",
      credentials: "same-origin",
      headers:     { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
      body:        JSON.stringify({ active }),
    });

    if (!res.ok) throw new Error("Toggle failed");

    /* Reload partners table and stats */
    await Promise.all([_loadPartners(), _loadStats()]);
  } catch {
    alert("Errore durante l'aggiornamento del partner. Riprova.");
  }
}

/* ─────────────────────────────────────────────────────────────
   PARTNER CREATION FORM
───────────────────────────────────────────────────────────── */
if (createPartnerForm) {
  createPartnerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (partnerError)   partnerError.classList.remove("visible");
    if (partnerSuccess) partnerSuccess.classList.remove("visible");

    const id          = newPartnerIdEl?.value.trim();
    const name        = partnerNameEl?.value.trim();
    const category    = partnerCategoryEl?.value.trim();
    const address     = partnerAddressEl?.value.trim();
    const tempPassword = partnerTempPassEl?.value;

    if (!id || !name || !tempPassword) {
      _showFeedback(partnerError, partnerErrorText, partnerSuccess, partnerSuccessText,
        false, "ID, nome e password temporanea sono obbligatori.");
      return;
    }

    if (tempPassword.length < 8) {
      _showFeedback(partnerError, partnerErrorText, partnerSuccess, partnerSuccessText,
        false, "La password temporanea deve avere almeno 8 caratteri.");
      return;
    }

    setLoading(createPartnerBtn, true);

    try {
      const res  = await fetch("/api/loyalty/admin/partners", {
        method:      "POST",
        credentials: "same-origin",
        headers:     { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body:        JSON.stringify({ id, name, category, address, tempPassword }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        _showFeedback(partnerError, partnerErrorText, partnerSuccess, partnerSuccessText,
          true, `Partner "${name}" creato con ID: ${data.partnerId}. Il partner dovrà impostare la propria password al primo accesso.`);
        createPartnerForm.reset();
        await Promise.all([_loadPartners(), _loadStats()]);
      } else {
        _showFeedback(partnerError, partnerErrorText, partnerSuccess, partnerSuccessText,
          false, data.message || "Errore nella creazione del partner.");
      }
    } catch {
      _showFeedback(partnerError, partnerErrorText, partnerSuccess, partnerSuccessText,
        false, "Errore di connessione. Riprova.");
    } finally {
      setLoading(createPartnerBtn, false);
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   OFFER CREATION FORM
───────────────────────────────────────────────────────────── */
if (addOfferForm) {
  addOfferForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (offerError)   offerError.classList.remove("visible");
    if (offerSuccess) offerSuccess.classList.remove("visible");

    const title       = offerTitleEl?.value.trim();
    const description = offerDescEl?.value.trim();
    const partnerId   = offerPartnerEl?.value.trim() === "" ? "Globale" : offerPartnerEl?.value.trim();

    if (!title) {
      if (offerErrorText) offerErrorText.textContent = "Il titolo dell'offerta è obbligatorio.";
      if (offerError)     offerError.classList.add("visible");
      offerTitleEl?.focus();
      return;
    }

    setLoading(addOfferBtn, true);

    try {
      const res  = await fetch("/api/loyalty/admin/offers", {
        method:      "POST",
        credentials: "same-origin",
        headers:     { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body:        JSON.stringify({ title, description, partnerId }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (offerSuccess) offerSuccess.classList.add("visible");
        addOfferForm.reset();
        await Promise.all([_loadOffers(), _loadStats()]);
      } else {
        if (offerErrorText) offerErrorText.textContent = data.message || "Errore nella creazione dell'offerta.";
        if (offerError)     offerError.classList.add("visible");
      }
    } catch {
      if (offerErrorText) offerErrorText.textContent = "Errore di connessione. Riprova.";
      if (offerError)     offerError.classList.add("visible");
    } finally {
      setLoading(addOfferBtn, false);
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   TAB SYSTEM
───────────────────────────────────────────────────────────── */
const _tabLoaders = {
  customers:   _loadCustomers,
  partners:    _loadPartners,
  offers:      _loadOffers,
  redemptions: _loadRedemptions,
};

tabBtns.forEach((btn) => {
  btn.addEventListener("click", async () => {
    const tab = btn.dataset.tab;
    if (tab === _activeTab) return;

    tabBtns.forEach((b) => { b.classList.remove("active"); b.setAttribute("aria-selected", "false"); });
    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");

    Object.values(tabPanels).forEach((p) => { if (p) p.style.display = "none"; });
    if (tabPanels[tab]) tabPanels[tab].style.display = "block";

    _activeTab = tab;
    if (_tabLoaders[tab]) await _tabLoaders[tab]();
  });
});

/* ─────────────────────────────────────────────────────────────
   DASHBOARD BOOT
───────────────────────────────────────────────────────────── */
async function _loadDashboard() {
  await _loadStats();
  await _loadCustomers(); // default tab
}

/* ─────────────────────────────────────────────────────────────
   BOOT Dashboard
───────────────────────────────────────────────────────────── */
_loadDashboard();