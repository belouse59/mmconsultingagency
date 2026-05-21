/**
 * js/features/loyalty/admin/admin.js
 * Admin panel — login + dashboard with tabs for customers, redemptions, offers.
 *
 * Key improvements over original:
 *   - Session verified via httpOnly cookie — no localStorage
 *   - Login panel shown/hidden based on server session check
 *   - All data fetched fresh on tab activation (no stale state)
 *   - Stats loaded on dashboard boot
 *   - All user-supplied content escaped before DOM injection (XSS prevention)
 *   - Offer creation with client validation + server error display
 *   - Accessible tab system (aria-selected, aria-controls)
 *   - Italian strings throughout
 */

/* ── DOM refs — login panel ── */
import { $, $$ } from "../../../core/dom.js";
const loginPanel      = $("#loginPanel");
const adminLoginForm  = $("#adminLoginForm");
const adminEmailEl    = $("#adminEmail");
const adminPassEl     = $("#adminPassword");
const loginSubmitBtn  = $("#loginSubmitBtn");
const loginError      = $("#loginError");
const loginErrorText  = $("#loginErrorText");

/* ── DOM refs — dashboard ── */
const adminDashboard    = $("#adminDashboard");
const adminTopbarActions = $("#adminTopbarActions");
const logoutBtn         = $("#logoutBtn");

/* ── DOM refs — stats ── */
const statCustomers   = $("#statCustomers");
const statRedemptions = $("#statRedemptions");
const statOffers      = $("#statOffers");
const statPartners    = $("#statPartners");

/* ── DOM refs — tabs ── */
const tabBtns         = $$(".loyalty-admin-tab");
const tabCustomers    = $("#tabCustomers");
const tabRedemptions  = $("#tabRedemptions");
const tabOffers       = $("#tabOffers");

/* ── DOM refs — tables ── */
const customersBody   = $("#customersTableBody");
const redemptionsBody = $("#redemptionsTableBody");
const offersBody      = $("#offersTableBody");

/* ── DOM refs — add offer form ── */
const addOfferForm    = $("#addOfferForm");
const offerTitleEl    = $("#offerTitle");
const offerDescEl     = $("#offerDescription");
const offerPartnerEl  = $("#offerPartner");
const addOfferBtn     = $("#addOfferBtn");
const offerError      = $("#offerError");
const offerErrorText  = $("#offerErrorText");
const offerSuccess    = $("#offerSuccess");

/* ── State ── */
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
      day:   "2-digit",
      month: "2-digit",
      year:  "numeric",
    });
  } catch {
    return iso;
  }
}

function _badge(active) {
  return active
    ? `<span class="loyalty-badge loyalty-badge--active">Attivo</span>`
    : `<span class="loyalty-badge loyalty-badge--inactive">Inattivo</span>`;
}

function _emptyRow(colspan, msg = "Nessun dato disponibile.") {
  return `<tr><td colspan="${colspan}" style="text-align:center;padding:28px;color:var(--text-secondary);">${_esc(msg)}</td></tr>`;
}

function _setLoading(btn, loading) {
  btn.disabled = loading;
  btn.classList.toggle("loading", loading);
}

/* ─────────────────────────────────────────────────────────────
   AUTH
───────────────────────────────────────────────────────────── */
async function checkSession() {
  try {
    const res = await fetch("/api/loyalty/admin/session", {
      credentials: "same-origin",
    });
    return res.ok;
  } catch {
    return false;
  }
}

function showLoginPanel() {
  loginPanel.style.display    = "block";
  adminDashboard.style.display = "none";
  adminTopbarActions.style.display = "none";
}

function showDashboard() {
  loginPanel.style.display     = "none";
  adminDashboard.style.display = "block";
  adminTopbarActions.style.display = "flex";
}

/* ── Login form submit ── */
adminLoginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.classList.remove("visible");

  const email    = adminEmailEl.value.trim();
  const password = adminPassEl.value;

  if (!email || !password) {
    loginErrorText.textContent = "Inserisci email e password.";
    loginError.classList.add("visible");
    return;
  }

  _setLoading(loginSubmitBtn, true);

  try {
    const res  = await fetch("/api/loyalty/admin/login", {
      method:      "POST",
      credentials: "same-origin",
      headers:     { "Content-Type": "application/json" },
      body:        JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      showDashboard();
      await loadDashboardData();
    } else {
      loginErrorText.textContent = data.message || "Credenziali non valide.";
      loginError.classList.add("visible");
      adminPassEl.value = "";
      adminPassEl.focus();
      _setLoading(loginSubmitBtn, false);
    }
  } catch {
    loginErrorText.textContent = "Errore di connessione. Riprova.";
    loginError.classList.add("visible");
    _setLoading(loginSubmitBtn, false);
  }
});

/* ── Logout ── */
logoutBtn.addEventListener("click", async () => {
  try {
    await fetch("/api/loyalty/admin/logout", {
      method:      "POST",
      credentials: "same-origin",
    });
  } catch { /* Best-effort */ }
  showLoginPanel();
   _setLoading(loginSubmitBtn, false);
});

/* ─────────────────────────────────────────────────────────────
   STATS
───────────────────────────────────────────────────────────── */
async function loadStats() {
  try {
    const [custRes, redeemRes, offerRes] = await Promise.all([
      fetch("/api/loyalty/admin/customers",   { credentials: "same-origin" }),
      fetch("/api/loyalty/admin/redemptions", { credentials: "same-origin" }),
      fetch("/api/loyalty/admin/offers",      { credentials: "same-origin" }),
    ]);

    const [custData, redeemData, offerData] = await Promise.all([
      custRes.json(),
      redeemRes.json(),
      offerRes.json(),
    ]);

    const customers    = custData.data   || [];
    const redemptions  = redeemData.data || [];
    const offers       = offerData.data  || [];

    statCustomers.textContent   = customers.length;
    statRedemptions.textContent = redemptions.length;
    statOffers.textContent      = offers.filter((o) => o.active).length;

    /* Partners: count unique partnerId values in redemptions */
    const uniquePartners = new Set(redemptions.map((r) => r.partnerId).filter(Boolean));
    statPartners.textContent = uniquePartners.size;
  } catch {
    statCustomers.textContent   = "—";
    statRedemptions.textContent = "—";
    statOffers.textContent      = "—";
    statPartners.textContent    = "—";
  }
}

/* ─────────────────────────────────────────────────────────────
   DATA LOADERS
───────────────────────────────────────────────────────────── */
async function loadCustomers() {
  customersBody.innerHTML = _emptyRow(6, "Caricamento...");

  try {
    const res  = await fetch("/api/loyalty/admin/customers", { credentials: "same-origin" });
    if (res.status === 401) { showLoginPanel(); return; }

    const data      = await res.json();
    const customers = data.data || [];

    if (!customers.length) {
      customersBody.innerHTML = _emptyRow(6, "Nessun cliente registrato.");
      return;
    }

    customersBody.innerHTML = customers.map((c) => `
      <tr>
        <td style="font-family:var(--font-display);font-size:0.72rem;">
          ${_esc(c.id)}
        </td>
        <td style="font-weight:600;">${_esc(c.full_name)}</td>
        <td>${_esc(c.identifier)}</td>
        <td>
          <span class="loyalty-badge loyalty-badge--pending">
            ${_esc(c.identifierType || "—")}
          </span>
        </td>
        <td>${_badge(c.active)}</td>
        <td style="font-size:0.8rem;">${_fmtDate(c.createdAt)}</td>
      </tr>
    `).join("");
  } catch {
    customersBody.innerHTML = _emptyRow(6, "Errore nel caricamento dei clienti.");
  }
}

async function loadRedemptions() {
  redemptionsBody.innerHTML = _emptyRow(5, "Caricamento...");

  try {
    const res  = await fetch("/api/loyalty/admin/redemptions", { credentials: "same-origin" });
    if (res.status === 401) { showLoginPanel(); return; }

    const data        = await res.json();
    const redemptions = data.data || [];

    if (!redemptions.length) {
      redemptionsBody.innerHTML = _emptyRow(5, "Nessun utilizzo registrato.");
      return;
    }

    redemptionsBody.innerHTML = redemptions.map((r) => `
      <tr>
        <td style="font-family:var(--font-display);font-size:0.72rem;">
          ${_esc(r.id)}
        </td>
        <td style="font-weight:600;">${_esc(r.customerId)}</td>
        <td>${_esc(r.partnerId)}</td>
        <td>${_esc(r.offerId)}</td>
        <td style="font-size:0.8rem;">${_fmtDate(r.createdAt)}</td>
      </tr>
    `).join("");
  } catch {
    redemptionsBody.innerHTML = _emptyRow(5, "Errore nel caricamento degli utilizzi.");
  }
}

async function loadOffers() {
  offersBody.innerHTML = _emptyRow(6, "Caricamento...");

  try {
    const res  = await fetch("/api/loyalty/admin/offers", { credentials: "same-origin" });
    if (res.status === 401) { showLoginPanel(); return; }

    const data   = await res.json();
    const offers = data.data || [];

    if (!offers.length) {
      offersBody.innerHTML = _emptyRow(6, "Nessuna offerta creata.");
      return;
    }

    offersBody.innerHTML = offers.map((o) => `
      <tr>
        <td style="font-family:var(--font-display);font-size:0.72rem;">
          ${_esc(o.id)}
        </td>
        <td style="font-weight:600;">${_esc(o.title)}</td>
        <td style="font-size:0.82rem;">${_esc(o.description || "—")}</td>
        <td style="font-size:0.82rem;">${_esc(o.partnerId || "Globale")}</td>
        <td>${_badge(o.active)}</td>
        <td style="font-size:0.8rem;">${_fmtDate(o.createdAt)}</td>
      </tr>
    `).join("");
  } catch {
    offersBody.innerHTML = _emptyRow(6, "Errore nel caricamento delle offerte.");
  }
}

/* ── Dashboard boot ── */
async function loadDashboardData() {
  await loadStats();
  await loadCustomers(); // default tab
}

/* ─────────────────────────────────────────────────────────────
   TABS
───────────────────────────────────────────────────────────── */
const tabPanels = {
  customers:   tabCustomers,
  redemptions: tabRedemptions,
  offers:      tabOffers,
};

const tabLoaders = {
  customers:   loadCustomers,
  redemptions: loadRedemptions,
  offers:      loadOffers,
};

tabBtns.forEach((btn) => {
  btn.addEventListener("click", async () => {
    const tab = btn.dataset.tab;
    if (tab === _activeTab) return;

    /* Update button states */
    tabBtns.forEach((b) => {
      b.classList.remove("active");
      b.setAttribute("aria-selected", "false");
    });
    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");

    /* Switch panels */
    Object.values(tabPanels).forEach((p) => (p.style.display = "none"));
    tabPanels[tab].style.display = "block";

    _activeTab = tab;

    /* Load data for the newly active tab */
    if (tabLoaders[tab]) await tabLoaders[tab]();
  });
});

/* ─────────────────────────────────────────────────────────────
   ADD OFFER FORM
───────────────────────────────────────────────────────────── */
addOfferForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  offerError.classList.remove("visible");
  offerSuccess.classList.remove("visible");

  const title       = offerTitleEl.value.trim();
  const description = offerDescEl.value.trim();
  const partnerId   = offerPartnerEl.value.trim();

  if (!title) {
    offerErrorText.textContent = "Il titolo dell'offerta è obbligatorio.";
    offerError.classList.add("visible");
    offerTitleEl.focus();
    return;
  }

  _setLoading(addOfferBtn, true);

  try {
    const res  = await fetch("/api/loyalty/admin/offers", {
      method:      "POST",
      credentials: "same-origin",
      headers:     { "Content-Type": "application/json" },
      body:        JSON.stringify({ title, description, partnerId }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      offerSuccess.classList.add("visible");
      addOfferForm.reset();
      /* Reload offers table to show new entry */
      await loadOffers();
      await loadStats();
    } else {
      offerErrorText.textContent = data.message || "Errore nella creazione dell'offerta.";
      offerError.classList.add("visible");
    }
  } catch {
    offerErrorText.textContent = "Errore di connessione. Riprova.";
    offerError.classList.add("visible");
  } finally {
    _setLoading(addOfferBtn, false);
  }
});

/* ─────────────────────────────────────────────────────────────
   BOOT
───────────────────────────────────────────────────────────── */
(async () => {
  const authenticated = await checkSession();

  if (authenticated) {
    showDashboard();
    await loadDashboardData();
  } else {
    showLoginPanel();
  }
})();
