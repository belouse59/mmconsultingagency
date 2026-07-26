"use strict";
/**
 * admin/modules.js
 *
 * All nine admin table modules: dashboard, customers, partners,
 * partner requests, offers, redemptions, newsletter, contacts,
 * simulator. Each module owns its own load function, state slice,
 * search/filter/page-size event listeners, and sort wiring.
 *
 * Imports from ui.js:      $, $$, esc, fmtDate, truncate, debounce,
 *                           Api, renderPagination, initSortableHeaders,
 *                           renderActionCell, wireActionMenus,
 *                           skeletonRows, emptyRow, badgeActive,
 *                           setLoading, showFeedback, showToast, showConfirm
 * Imports from drawers.js: openCreatePartnerDrawer, openEditPartnerDrawer,
 *                           openApproveRequestDrawer, openEditCustomerDrawer,
 *                           openCreateCustomerDrawer, openEditOfferDrawer
 */

import {
  $, $$, esc, fmtDate, truncate, debounce,
  Api,
  renderPagination,
  initSortableHeaders,
  renderActionCell, wireActionMenus,
  skeletonRows, emptyRow, badgeActive,
  setLoading, showFeedback, showToast, showConfirm,
} from "./ui.js";

import {
  openCreatePartnerDrawer,
  openEditPartnerDrawer,
  openApproveRequestDrawer,
  openCreateCustomerDrawer,
  openEditCustomerDrawer,
  openEditOfferDrawer,
} from "./drawers.js";

/*
   SECTION 4 — MODULE STATE
   Each module has its own isolated state object.
   Shape mirrors the paginationMiddleware req.pagination contract.
═══════════════════════════════════════════════════════════ */

export function makeState(defaults = {}) {
  return {
    page:      1,
    limit:     20,
    search:    "",
    sortBy:    "createdAt",
    sortOrder: "desc",
    filters:   {},
    ...defaults,
  };
}

export const State = {
  customers:       makeState(),
  partners:        makeState(),
  partnerRequests: makeState({ sortBy: "createdAt", filters: { status: "pending" } }),
  offers:          makeState(),
  redemptions:     makeState({ sortBy: "redeemedAt" }),
  newsletter:      makeState({ sortBy: "createdAt" }),
  contacts:        makeState({ sortBy: "createdAt" }),
  simulator:       makeState({ sortBy: "createdAt" }),
};


/* ═══════════════════════════════════════════════════════════
   SECTION 5 — NAVIGATION / SIDEBAR
═══════════════════════════════════════════════════════════ */

const admSidebar  = $("#admSidebar");
const admOverlay  = $("#admOverlay");
const admBurger   = $("#admBurger");
const admBreadcrumbCurrent = $("#admBreadcrumbCurrent");

export const MODULE_LABELS = {
  dashboard:       "Dashboard",
  customers:       "Clienti",
  partners:        "Partner",
  partnerRequests: "Richieste Partner",
  offers:          "Offerte",
  redemptions:     "Utilizzi",
  newsletter:      "Newsletter",
  contacts:        "Richieste di Contatto",
  simulator:       "Lead Simulatore",
};

let _activeModule = "dashboard";

/** Switch to a given module key */
export function switchModule(key) {
  if (!MODULE_LABELS[key]) return;

  // Hide all modules
  $$(".adm-module").forEach((el) => { el.style.display = "none"; });

  // Show target
  const target = $(`#module${key.charAt(0).toUpperCase() + key.slice(1)}`);
  if (target) target.style.display = "block";

  // Update nav active state
  $$(".adm-nav-item").forEach((btn) => {
    const isActive = btn.dataset.module === key;
    btn.classList.toggle("active", isActive);
    btn.setAttribute("aria-current", isActive ? "page" : "false");
  });

  // Update breadcrumb
  if (admBreadcrumbCurrent) {
    admBreadcrumbCurrent.textContent = MODULE_LABELS[key] || key;
  }

  // Close mobile sidebar
  closeSidebar();

  _activeModule = key;

  // Load data for the module if not dashboard
  if (key === "dashboard") {
    loadDashboard();
  } else if (key === "customers") {
    loadCustomers();
  } else if (key === "partners") {
    loadPartners();
  } else if (key === "partnerRequests") {
    loadPartnerRequests();
  } else if (key === "offers") {
    loadOffers();
  } else if (key === "redemptions") {
    loadRedemptions();
  } else if (key === "newsletter") {
    loadNewsletter();
  } else if (key === "contacts") {
    loadContacts();
  } else if (key === "simulator") {
    loadSimulator();
  }
}

/** Wire sidebar nav item buttons */
$$(".adm-nav-item[data-module]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.disabled) return;
    switchModule(btn.dataset.module);
  });
});

/** Wire "View all" / navigate buttons with data-nav attribute */
$$("#admContent [data-nav]").forEach((btn) => {
  btn.addEventListener("click", () => {
    switchModule(btn.dataset.nav);
  });
});

/** Mobile sidebar open / close */
function openSidebar() {
  admSidebar?.classList.add("open");
  admOverlay?.classList.add("visible");
  admBurger?.setAttribute("aria-expanded", "true");
  document.body.style.overflow = "hidden";
}

function closeSidebar() {
  admSidebar?.classList.remove("open");
  admOverlay?.classList.remove("visible");
  admBurger?.setAttribute("aria-expanded", "false");
  document.body.style.overflow = "";
}

admBurger?.addEventListener("click", () => {
  const isOpen = admSidebar?.classList.contains("open");
  isOpen ? closeSidebar() : openSidebar();
});

admOverlay?.addEventListener("click", closeSidebar);

// Close on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && admSidebar?.classList.contains("open")) {
    closeSidebar();
  }
});

// Logout
$("#admLogoutBtn")?.addEventListener("click", async () => {
  try {
    await fetch("/api/loyalty/admin/logout", {
      method:      "POST",
      credentials: "same-origin",
      headers:     { "X-Requested-With": "XMLHttpRequest" },
    });
  } catch { /* best-effort */ }
  window.location.replace("/loyalty/admin/login.html");
});


/* ═══════════════════════════════════════════════════════════

   SECTION 7 — STATS & DASHBOARD
═══════════════════════════════════════════════════════════ */

const statCustomers   = $("#statCustomers");
const statPartners    = $("#statPartners");
const statOffers      = $("#statOffers");
const statRedemptions = $("#statRedemptions");

/**
 * Load stats using the paginated endpoints with limit=1.
 * totalItems in the pagination meta gives the true count
 * without loading all rows.
 */
export async function loadStats() {
  // Set loading placeholders
  [statCustomers, statPartners, statOffers, statRedemptions, ...$$(".adm-nav-count")]
    .forEach((el) => { if (el) el.textContent = "—"; });

  try {
    const [cData, pData, oData, rData, prData, nlData, ctData, simData] = await Promise.all([
      Api.getPaginated("/customers",        { limit: 1 }),
      Api.getPaginated("/partners",         { limit: 1, filters: { active: "true" } }),
      Api.getPaginated("/offers",           { limit: 1, filters: { active: "true" } }),
      Api.getPaginated("/redemptions",      { limit: 1 }),
      Api.getPaginated("/partner-requests", { limit: 1, filters: { status: "pending" } }),
      Api.getPaginated("/newsletters",      { limit: 1, filters: { subscribed: "true" } }),
      Api.getPaginated("/contacts",         { limit: 1 }),
      Api.getPaginated("/simulator",        { limit: 1 }),
    ]);

    const cTotal   = cData?.pagination?.totalItems   ?? "—";
    const pTotal   = pData?.pagination?.totalItems   ?? "—";
    const oTotal   = oData?.pagination?.totalItems   ?? "—";
    const rTotal   = rData?.pagination?.totalItems   ?? "—";
    const prTotal  = prData?.pagination?.totalItems  ?? "—";
    const nlTotal  = nlData?.pagination?.totalItems  ?? "—";
    const ctTotal  = ctData?.pagination?.totalItems  ?? "—";
    const simTotal = simData?.pagination?.totalItems ?? "—";

    if (statCustomers)   statCustomers.textContent   = cTotal;
    if (statPartners)    statPartners.textContent     = pTotal;
    if (statOffers)      statOffers.textContent       = oTotal;
    if (statRedemptions) statRedemptions.textContent  = rTotal;

    // Sidebar counts
    const nc   = $("#navCountCustomers");
    const np   = $("#navCountPartners");
    const no   = $("#navCountOffers");
    const nr   = $("#navCountRedemptions");
    const npr  = $("#navCountPartnerRequests");
    const nnl  = $("#navCountNewsletters");
    const nct  = $("#navCountContacts");
    const nsim = $("#navCountSimulator");

    if (nc)   nc.textContent   = cTotal;
    if (np)   np.textContent   = pTotal;
    if (no)   no.textContent   = oTotal;
    if (nr)   nr.textContent   = rTotal;
    if (nnl)  nnl.textContent  = nlTotal;
    if (nct)  nct.textContent  = ctTotal;
    if (nsim) nsim.textContent = simTotal;

    // Highlight pending partner requests badge if > 0
    if (npr) {
      npr.textContent = prTotal;
      if (prTotal > 0) {
        npr.style.background = "rgba(212,160,23,0.25)";
        npr.style.color      = "var(--loy-gold)";
      }
    }

  } catch {
    [statCustomers, statPartners, statOffers, statRedemptions]
      .forEach((el) => { if (el) el.textContent = "—"; });
  }
}

/** Load dashboard: stats + recent redemptions preview */
export async function loadDashboard() {
  await loadStats();
  await loadRecentRedemptions();
}

async function loadRecentRedemptions() {
  const body = $("#dashRecentBody");
  if (!body) return;

  body.innerHTML = skeletonRows(4, 5);

  try {
    const data = await Api.getPaginated("/redemptions", { limit: 5, page: 1, sortBy: "redeemedAt", sortOrder: "desc" });
    const rows = data?.data || [];

    if (!rows.length) {
      body.innerHTML = emptyRow(4, "Nessun utilizzo registrato.");
      return;
    }

    body.innerHTML = rows.map((r) => `
      <tr>
        <td class="adm-td-secondary">${esc(truncate(r.customerId, 22))}</td>
        <td><span class="adm-badge adm-badge--neutral">${esc(r.partnerId)}</span></td>
        <td class="adm-td-secondary">${esc(truncate(r.offerId, 24))}</td>
        <td class="adm-td-date">${fmtDate(r.redeemedAt)}</td>
      </tr>`).join("");
  } catch {
    body.innerHTML = emptyRow(4, "Errore nel caricamento degli utilizzi recenti.");
  }
}


/* ═══════════════════════════════════════════════════════════
   SECTION 8 — CUSTOMERS MODULE
═══════════════════════════════════════════════════════════ */

const customersTable = $("#moduleCustomers .adm-table");
const customersBody  = $("#customersTableBody");
const customersCount = $("#customersCount");

const _customersCache = new Map();

export async function loadCustomers() {
  if (!customersBody) return;
  customersBody.innerHTML = skeletonRows(6);

  try {
    const data = await Api.getPaginated("/customers", State.customers);
    if (!data) return;

    const rows  = data.data || [];
    const meta  = data.pagination;

    _customersCache.clear();
    rows.forEach((c) => _customersCache.set(c.id, c));

    // Update count label
    if (customersCount && meta) {
      customersCount.textContent = `${meta.totalItems.toLocaleString("it-IT")} clienti`;
    }

    if (!rows.length) {
      customersBody.innerHTML = emptyRow(6, State.customers.search
        ? `Nessun cliente trovato per "${State.customers.search}".`
        : "Nessun cliente registrato.");
    } else {
      customersBody.innerHTML = rows.map((c) => `
        <tr>
          <td>
            <div class="adm-td-name">${esc(c.full_name)}</div>
          </td>
          <td class="adm-td-secondary">${esc(c.identifier)}</td>
          <td>
            <span class="adm-badge adm-badge--neutral">
              ${esc(c.identifierType === "email" ? "Email" : c.identifierType === "phone" ? "Telefono" : c.identifierType || "—")}
            </span>
          </td>
          <td>${badgeActive(c.active)}</td>
          <td class="adm-td-date">${fmtDate(c.createdAt)}</td>
          <td class="adm-td-actions">
            ${renderActionCell(c.id,
              `<button class="adm-btn adm-btn--secondary adm-btn--sm" data-edit-customer="${esc(c.id)}">
                 Modifica
               </button>`,
              [
                { label: c.active ? "Sospendi" : "Attiva", icon: c.active ? "fa-ban" : "fa-check", action: "toggle-active", danger: c.active },
                ...(c.verified ? [] : [{ label: "Invia verifica", icon: "fa-envelope", action: "resend-verification" }]),
              ]
            )}
          </td>
        </tr>`).join("");
    }

    // Render pagination
    renderPagination(
      $("#customersPaginationControls"),
      $("#customersPaginationInfo"),
      meta,
      (p) => { State.customers.page = p; loadCustomers(); }
    );

    // Wire "Modifica" buttons → open customer edit drawer
    customersBody.querySelectorAll("[data-edit-customer]").forEach((btn) => {
      btn.addEventListener("click", () => {
        openEditCustomerDrawer(btn.dataset.editCustomer);
      });
    });

    wireActionMenus(customersBody, async (action, rowId) => {
      const c = _customersCache.get(rowId);
      if (!c) return;

      if (action === "toggle-active") {
        const nextActive = !c.active;
        showConfirm(
          nextActive ? `Attivare il cliente "${c.full_name}"?` : `Sospendere il cliente "${c.full_name}"?`,
          nextActive ? "Il cliente potrà nuovamente accedere al suo account." : "Il cliente non potrà accedere fino alla riattivazione.",
          async () => {
            try {
              const res = await Api.patch(`/customers/${encodeURIComponent(rowId)}/active`, { active: nextActive });
              if (res?.success) {
                showToast(nextActive ? "Cliente attivato." : "Cliente sospeso.");
                await Promise.all([loadCustomers(), loadStats()]);
              } else {
                showToast(res?.message || "Errore durante l'operazione.", "error");
              }
            } catch {
              showToast("Errore di connessione.", "error");
            }
          }
        );
      }

      if (action === "resend-verification") {
        try {
          const res = await Api.post(`/customers/${encodeURIComponent(rowId)}/resend-verification`, {});
          showToast(res?.message || "Email di verifica inviata.", res?.success === false ? "error" : "success");
        } catch {
          showToast("Errore di connessione.", "error");
        }
      }
    });

  } catch {
    customersBody.innerHTML = emptyRow(6, "Errore nel caricamento clienti. Riprova.");
  }
}

// Search
const customersSearchInput = $("#customersSearch");
customersSearchInput?.addEventListener("input", debounce(() => {
  State.customers.search = customersSearchInput.value.trim();
  State.customers.page   = 1;
  loadCustomers();
}, 380));

// Status filter
const customersStatusFilter = $("#customersStatusFilter");
customersStatusFilter?.addEventListener("change", () => {
  State.customers.filters.active = customersStatusFilter.value;
  State.customers.page = 1;
  loadCustomers();
});

// Page size
$("#customersPageSize")?.addEventListener("change", function () {
  State.customers.limit = parseInt(this.value, 10);
  State.customers.page  = 1;
  loadCustomers();
});

// Sortable headers
initSortableHeaders(customersTable, State.customers, loadCustomers);


/* ═══════════════════════════════════════════════════════════
   SECTION 9 — PARTNERS MODULE (LIST)
═══════════════════════════════════════════════════════════ */

const partnersTable = $("#modulePartners .adm-table");
const partnersBody  = $("#partnersTableBody");
const partnersCount = $("#partnersCount");

const _partnersCache = new Map();

export async function loadPartners() {
  if (!partnersBody) return;
  partnersBody.innerHTML = skeletonRows(7);

  try {
    const data = await Api.getPaginated("/partners", State.partners);
    if (!data) return;

    const rows = data.data || [];
    const meta = data.pagination;

    _partnersCache.clear();
    rows.forEach((p) => _partnersCache.set(p.id, p));

    if (partnersCount && meta) {
      partnersCount.textContent = `${meta.totalItems.toLocaleString("it-IT")} partner`;
    }

    if (!rows.length) {
      partnersBody.innerHTML = emptyRow(7, State.partners.search
        ? `Nessun partner trovato per "${State.partners.search}".`
        : "Nessun partner creato.");
    } else {
      partnersBody.innerHTML = rows.map((p) => `
        <tr>
          <td class="adm-td-id" title="${esc(p.id)}">${esc(truncate(p.id, 18))}</td>
          <td class="adm-td-name">${esc(p.name)}</td>
          <td class="adm-td-secondary">${esc(p.category || "—")}</td>
          <td class="adm-td-secondary">${esc(truncate(p.address || "—", 28))}</td>
          <td>${badgeActive(p.active)}</td>
          <td>
            ${p.mustChangePassword
              ? `<span class="adm-badge adm-badge--pending">Da impostare</span>`
              : `<span class="adm-badge adm-badge--active">Impostata</span>`}
          </td>
          <td class="adm-td-actions">
            <div class="adm-row-actions">
              <button class="adm-btn adm-btn--secondary adm-btn--sm" data-edit-partner="${esc(p.id)}">
                Modifica
              </button>
              ${renderActionCell(p.id, "", [
                { label: p.active ? "Sospendi" : "Attiva", icon: p.active ? "fa-ban" : "fa-check", action: "toggle-active", danger: p.active },
                { label: "Reimposta password", icon: "fa-key", action: "force-password-reset" },
              ])}
            </div>
          </td>
        </tr>`).join("");
    }

    renderPagination(
      $("#partnersPaginationControls"),
      $("#partnersPaginationInfo"),
      meta,
      (p) => { State.partners.page = p; loadPartners(); }
    );

    // Wire "Modifica" buttons → open edit drawer
    partnersBody.querySelectorAll("[data-edit-partner]").forEach((btn) => {
      btn.addEventListener("click", () => {
        openEditPartnerDrawer(btn.dataset.editPartner);
      });
    });

    wireActionMenus(partnersBody, async (action, rowId) => {
      const p = _partnersCache.get(rowId);
      if (!p) return;

      if (action === "toggle-active") {
        const nextActive = !p.active;
        showConfirm(
          nextActive ? `Attivare il partner "${p.name}"?` : `Sospendere il partner "${p.name}"?`,
          nextActive ? "Il partner potrà nuovamente accedere alla dashboard." : "Il partner non potrà accedere fino alla riattivazione.",
          async () => togglePartnerActive(rowId, nextActive)
        );
      }

      if (action === "force-password-reset") {
        showConfirm(
          `Forzare il reset password per "${p.name}"?`,
          "Il partner dovrà impostare una nuova password al prossimo accesso.",
          async () => {
            try {
              const res = await Api.post(`/partners/${encodeURIComponent(rowId)}/force-password-reset`, {});
              showToast(res?.message || "Reset password forzato.", res?.success === false ? "error" : "success");
              if (res?.success) await loadPartners();
            } catch {
              showToast("Errore di connessione.", "error");
            }
          }
        );
      }
    });

  } catch {
    partnersBody.innerHTML = emptyRow(7, "Errore nel caricamento partner. Riprova.");
  }
}

async function togglePartnerActive(partnerId, active) {
  try {
    const res = await Api.patch(`/partners/${encodeURIComponent(partnerId)}/active`, { active });
    if (res?.success !== false) {
      await Promise.all([loadPartners(), loadStats()]);
    } else {
      alert("Errore durante l'aggiornamento. Riprova.");
    }
  } catch {
    alert("Errore di connessione. Riprova.");
  }
}

// Search
const partnersSearchInput = $("#partnersSearch");
partnersSearchInput?.addEventListener("input", debounce(() => {
  State.partners.search = partnersSearchInput.value.trim();
  State.partners.page   = 1;
  loadPartners();
}, 380));

// Status filter
const partnersStatusFilter = $("#partnersStatusFilter");
partnersStatusFilter?.addEventListener("change", () => {
  State.partners.filters.active = partnersStatusFilter.value;
  State.partners.page = 1;
  loadPartners();
});

// Page size
$("#partnersPageSize")?.addEventListener("change", function () {
  State.partners.limit = parseInt(this.value, 10);
  State.partners.page  = 1;
  loadPartners();
});

// Sort
initSortableHeaders(partnersTable, State.partners, loadPartners);


/* ═══════════════════════════════════════════════════════════

   SECTION 9C — PARTNER REQUESTS MODULE
   (list + approve via partner drawer pre-filled mode
   + reject via dedicated modal with notes textarea)
═══════════════════════════════════════════════════════════ */

const partnerRequestsTable  = $("#modulePartnerRequests .adm-table");
const partnerRequestsBody   = $("#partnerRequestsTableBody");
const partnerRequestsCount  = $("#partnerRequestsCount");

/** Map internal category keys to Italian display labels */
const CATEGORY_LABELS = {
  ristorante: "Ristorante",
  bar:        "Bar / Caffè",
  palestra:   "Palestra / Sport",
  negozio:    "Negozio / Retail",
  servizi:    "Servizi professionali",
  beauty:     "Beauty & Benessere",
  altro:      "Altro",
};

/** Map request status keys to badge HTML */
function requestStatusBadge(status) {
  const map = {
    pending:  `<span class="adm-badge adm-badge--pending">In attesa</span>`,
    approved: `<span class="adm-badge adm-badge--active">Approvata</span>`,
    rejected: `<span class="adm-badge adm-badge--inactive">Rifiutata</span>`,
    archived: `<span class="adm-badge adm-badge--neutral">Archiviata</span>`,
  };
  return map[status] || `<span class="adm-badge adm-badge--neutral">${esc(status)}</span>`;
}

/**
 * In-memory map of request objects from the last API response.
 * Keyed by request ID. Used by the Approve/Reject button handlers
 * so we can pass the full object to openApproveRequestDrawer()
 * without a second API call or HTML-encoded JSON in data attributes.
 */
const _partnerRequestsCache = new Map();

export async function loadPartnerRequests() {
  if (!partnerRequestsBody) return;
  partnerRequestsBody.innerHTML = skeletonRows(7);

  try {
    const data = await Api.getPaginated("/partner-requests", State.partnerRequests);
    if (!data) return;

    const rows = data.data || [];
    const meta = data.pagination;

    // Populate in-memory cache for this page of results.
    _partnerRequestsCache.clear();
    rows.forEach((r) => _partnerRequestsCache.set(r.id, r));

    if (partnerRequestsCount && meta) {
      partnerRequestsCount.textContent = `${meta.totalItems.toLocaleString("it-IT")} richieste`;
    }

    if (!rows.length) {
      partnerRequestsBody.innerHTML = emptyRow(7, State.partnerRequests.search
        ? `Nessuna richiesta trovata per "${State.partnerRequests.search}".`
        : "Nessuna richiesta ricevuta.");
    } else {
      partnerRequestsBody.innerHTML = rows.map((r) => {
        const isPending = r.status === "pending";
        const catLabel  = CATEGORY_LABELS[r.category] || esc(r.category);

        return `
          <tr>
            <td>
              <div class="adm-td-name">${esc(r.businessName)}</div>
              ${r.vatNumber
                ? `<div class="adm-td-secondary" style="font-size:0.75rem;">${esc(r.vatNumber)}</div>`
                : ""}
            </td>
            <td>
              <span class="adm-badge adm-badge--neutral">${esc(catLabel)}</span>
            </td>
            <td class="adm-td-secondary">
              <a href="mailto:${esc(r.email)}"
                style="color:var(--loy-gold-dark);text-decoration:none;"
              >${esc(r.email)}</a>
              ${r.phone
                ? `<div style="font-size:0.75rem;margin-top:2px;">${esc(r.phone)}</div>`
                : ""}
            </td>
            <td class="adm-td-secondary" style="max-width:180px;">
              ${r.description
                ? `<span
                     class="adm-td-proposal-preview"
                     title="${esc(r.description)}"
                     style="
                       display:block;
                       overflow:hidden;
                       white-space:nowrap;
                       text-overflow:ellipsis;
                       max-width:160px;
                     "
                   >${esc(r.description)}</span>
                   <button
                     class="adm-btn adm-btn--secondary adm-btn--sm"
                     data-proposal-id="${esc(r.id)}"
                     style="margin-top:4px;font-size:0.68rem;padding:3px 10px;"
                   >Dettagli</button>`
                : `<span class="adm-td-secondary">—</span>`}
            </td>
            <td>${requestStatusBadge(r.status)}</td>
            <td class="adm-td-date">${fmtDate(r.createdAt)}</td>
            <td class="adm-td-actions">
              <div class="adm-row-actions">
                ${isPending
                  ? `
                    <button
                      class="adm-btn adm-btn--primary adm-btn--sm"
                      data-approve-request="${esc(r.id)}"
                    >Approva</button>
                    <button
                      class="adm-btn adm-btn--danger adm-btn--sm"
                      data-reject-request="${esc(r.id)}"
                      data-request-name="${esc(r.businessName)}"
                    >Rifiuta</button>`
                  : r.convertedPartnerId
                    ? `<button
                         class="adm-btn adm-btn--secondary adm-btn--sm"
                         data-nav="partners"
                       >Partner →</button>`
                    : ""}
                ${renderActionCell(r.id, "", [
                  { label: "Contatta", icon: "fa-envelope", action: "contact" },
                  ...(r.status !== "archived"
                    ? [{ label: "Archivia", icon: "fa-box-archive", action: "archive", danger: true }]
                    : []),
                ])}
              </div>
            </td>
          </tr>`;
      }).join("");
    }

    renderPagination(
      $("#partnerRequestsPaginationControls"),
      $("#partnerRequestsPaginationInfo"),
      meta,
      (p) => { State.partnerRequests.page = p; loadPartnerRequests(); }
    );

    // Wire "Approva" — pass the full cached request object.
    // No second API call needed: the data is already in memory.
    partnerRequestsBody.querySelectorAll("[data-approve-request]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const requestObj = _partnerRequestsCache.get(btn.dataset.approveRequest);
        if (requestObj) openApproveRequestDrawer(requestObj);
      });
    });

    // Wire "Rifiuta" — only needs id + name for the confirm modal.
    partnerRequestsBody.querySelectorAll("[data-reject-request]").forEach((btn) => {
      btn.addEventListener("click", () => {
        openRejectModal(btn.dataset.rejectRequest, btn.dataset.requestName);
      });
    });

    // Wire "Partner →" shortcut buttons
    partnerRequestsBody.querySelectorAll("[data-nav]").forEach((btn) => {
      btn.addEventListener("click", () => switchModule(btn.dataset.nav));
    });

    // Wire "Dettagli" proposal buttons
    partnerRequestsBody.querySelectorAll("[data-proposal-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const requestObj = _partnerRequestsCache.get(btn.dataset.proposalId);
        if (requestObj) openProposalModal(requestObj);
      });
    });

    wireActionMenus(partnerRequestsBody, async (action, rowId) => {
      const r = _partnerRequestsCache.get(rowId);
      if (!r) return;

      if (action === "contact") {
        window.location.href = `mailto:${r.email}`;
      }

      if (action === "archive") {
        showConfirm(
          `Archiviare la richiesta di "${r.businessName}"?`,
          "La richiesta verrà nascosta dalla vista predefinita ma resterà consultabile dal database.",
          async () => {
            try {
              const res = await Api.patch(`/partner-requests/${encodeURIComponent(rowId)}/archive`, {});
              if (res?.success) {
                showToast("Richiesta archiviata.");
                await Promise.all([loadPartnerRequests(), loadStats()]);
              } else {
                showToast(res?.message || "Errore durante l'archiviazione.", "error");
              }
            } catch {
              showToast("Errore di connessione.", "error");
            }
          }
        );
      }
    });

  } catch {
    partnerRequestsBody.innerHTML = emptyRow(7, "Errore nel caricamento richieste. Riprova.");
  }
}

// Search
const partnerRequestsSearchInput = $("#partnerRequestsSearch");
partnerRequestsSearchInput?.addEventListener("input", debounce(() => {
  State.partnerRequests.search = partnerRequestsSearchInput.value.trim();
  State.partnerRequests.page   = 1;
  loadPartnerRequests();
}, 380));

// Status filter
const partnerRequestsStatusFilter = $("#partnerRequestsStatusFilter");
partnerRequestsStatusFilter?.addEventListener("change", () => {
  State.partnerRequests.filters.status = partnerRequestsStatusFilter.value;
  State.partnerRequests.page = 1;
  loadPartnerRequests();
});

// Page size
$("#partnerRequestsPageSize")?.addEventListener("change", function () {
  State.partnerRequests.limit = parseInt(this.value, 10);
  State.partnerRequests.page  = 1;
  loadPartnerRequests();
});

// Sort
initSortableHeaders(partnerRequestsTable, State.partnerRequests, loadPartnerRequests);


/* ── PROPOSAL DETAIL MODAL ─────────────────────────────── */

const admProposalModal = $("#admProposalModal");
const admProposalTitle = $("#admProposalTitle");
const admProposalMeta  = $("#admProposalMeta");
const admProposalBody  = $("#admProposalBody");
const admProposalClose = $("#admProposalClose");

function openProposalModal(requestObj) {
  if (!admProposalModal) return;

  if (admProposalTitle) admProposalTitle.textContent = "Proposta partner";
  if (admProposalMeta) {
    admProposalMeta.textContent =
      `${requestObj.businessName} · ${CATEGORY_LABELS[requestObj.category] || requestObj.category}`;
  }
  if (admProposalBody) {
    admProposalBody.textContent = requestObj.description || "Nessuna proposta fornita.";
  }

  admProposalModal.classList.add("open");
  admProposalClose?.focus();
}

function closeProposalModal() {
  admProposalModal?.classList.remove("open");
}

admProposalClose?.addEventListener("click", closeProposalModal);

admProposalModal?.addEventListener("click", (e) => {
  if (e.target === admProposalModal) closeProposalModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && admProposalModal?.classList.contains("open")) {
    closeProposalModal();
  }
});


/* ── REJECT: modal with notes textarea ─────────────────── */

const admRejectModal  = $("#admRejectModal");
const admRejectCancel = $("#admRejectCancel");
const admRejectOk     = $("#admRejectOk");
const admRejectNotes  = $("#admRejectNotes");

let _rejectRequestId  = null;

function openRejectModal(requestId, requestName) {
  _rejectRequestId = requestId;
  if (admRejectNotes) admRejectNotes.value = "";

  const body = admRejectModal?.querySelector("#admRejectBody");
  if (body) {
    body.textContent =
      `Rifiuta la richiesta di "${requestName}"? La richiesta verrà contrassegnata come rifiutata. Puoi aggiungere una nota interna.`;
  }

  admRejectModal?.classList.add("open");
  admRejectNotes?.focus();
}

function closeRejectModal() {
  admRejectModal?.classList.remove("open");
  _rejectRequestId = null;
}

admRejectCancel?.addEventListener("click", closeRejectModal);

admRejectModal?.addEventListener("click", (e) => {
  if (e.target === admRejectModal) closeRejectModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && admRejectModal?.classList.contains("open")) {
    closeRejectModal();
  }
});

admRejectOk?.addEventListener("click", async () => {
  if (!_rejectRequestId) return;

  const notes = admRejectNotes?.value.trim() || "";
  setLoading(admRejectOk, true);

  try {
    const res = await Api.post(
      `/partner-requests/${encodeURIComponent(_rejectRequestId)}/reject`,
      { reviewNotes: notes }
    );

    if (res?.success) {
      closeRejectModal();
      await Promise.all([loadPartnerRequests(), loadStats()]);
    } else {
      alert(res?.message || "Errore durante il rifiuto. Riprova.");
    }
  } catch {
    alert("Errore di connessione. Riprova.");
  } finally {
    setLoading(admRejectOk, false);
  }
});



/* ═══════════════════════════════════════════════════════════

   SECTION 10 — OFFERS MODULE
═══════════════════════════════════════════════════════════ */

const offersTable = $("#moduleOffers .adm-table");
const offersBody  = $("#offersTableBody");
const offersCount = $("#offersCount");
const _offersCache = new Map();

export async function loadOffers() {
  if (!offersBody) return;
  offersBody.innerHTML = skeletonRows(6);

  try {
    const data = await Api.getPaginated("/offers", State.offers);
    if (!data) return;

    const rows = data.data || [];
    const meta = data.pagination;

    _offersCache.clear();
    rows.forEach((o) => _offersCache.set(o.id, o));

    if (offersCount && meta) {
      offersCount.textContent = `${meta.totalItems.toLocaleString("it-IT")} offerte`;
    }

    if (!rows.length) {
      offersBody.innerHTML = emptyRow(6, State.offers.search
        ? `Nessuna offerta trovata per "${State.offers.search}".`
        : "Nessuna offerta creata.");
    } else {
      offersBody.innerHTML = rows.map((o) => `
        <tr>
          <td class="adm-td-name">${esc(o.title)}</td>
          <td class="adm-td-secondary">${esc(truncate(o.description || "—", 48))}</td>
          <td>
            <span class="adm-badge ${o.partnerId === "Globale" ? "adm-badge--navy" : "adm-badge--neutral"}">
              ${esc(o.partnerId || "Globale")}
            </span>
          </td>
          <td>${badgeActive(o.active)}</td>
          <td class="adm-td-date">${fmtDate(o.createdAt)}</td>
          <td class="adm-td-actions">
            ${renderActionCell(o.id,
              `<button
                 class="adm-btn adm-btn--secondary adm-btn--sm"
                 data-edit-offer="${esc(o.id)}"
               >Modifica</button>`,
              [
                {
                  label:  o.active ? "Sospendi" : "Attiva",
                  icon:   o.active ? "fa-ban"   : "fa-check",
                  action: "toggle-active",
                  danger: o.active,
                },
              ]
            )}
          </td>
        </tr>`).join("");
    }

    renderPagination(
      $("#offersPaginationControls"),
      $("#offersPaginationInfo"),
      meta,
      (p) => { State.offers.page = p; loadOffers(); }
    );

    // Wire "Modifica" buttons → open offer edit drawer
    offersBody.querySelectorAll("[data-edit-offer]").forEach((btn) => {
      btn.addEventListener("click", () => {
        openEditOfferDrawer(btn.dataset.editOffer);
      });
    });

    wireActionMenus(offersBody, async (action, rowId) => {
      const o = _offersCache.get(rowId);
      if (!o) return;

      if (action === "toggle-active") {
        const nextActive = !o.active;
        showConfirm(
          nextActive
            ? `Attivare l'offerta "${o.title}"?`
            : `Sospendere l'offerta "${o.title}"?`,
          nextActive
            ? "L'offerta sarà visibile ai clienti."
            : "L'offerta non sarà visibile ai clienti fino alla riattivazione.",
          async () => {
            try {
              const res = await Api.patch(
                `/offers/${encodeURIComponent(rowId)}`,
                { title: o.title, description: o.description || "", active: nextActive }
              );
              if (res?.success) {
                showToast(nextActive ? "Offerta attivata." : "Offerta sospesa.");
                await Promise.all([loadOffers(), loadStats()]);
              } else {
                showToast(res?.message || "Errore durante l'operazione.", "error");
              }
            } catch {
              showToast("Errore di connessione.", "error");
            }
          }
        );
      }
    });

  } catch {
    offersBody.innerHTML = emptyRow(6, "Errore nel caricamento offerte. Riprova.");
  }
}

// Search
const offersSearchInput = $("#offersSearch");
offersSearchInput?.addEventListener("input", debounce(() => {
  State.offers.search = offersSearchInput.value.trim();
  State.offers.page   = 1;
  loadOffers();
}, 380));

// Status filter
const offersStatusFilter = $("#offersStatusFilter");
offersStatusFilter?.addEventListener("change", () => {
  State.offers.filters.active = offersStatusFilter.value;
  State.offers.page = 1;
  loadOffers();
});

// Page size
$("#offersPageSize")?.addEventListener("change", function () {
  State.offers.limit = parseInt(this.value, 10);
  State.offers.page  = 1;
  loadOffers();
});

// Sort
initSortableHeaders(offersTable, State.offers, loadOffers);

// Form panel toggle
const admOfferFormPanel  = $("#admOfferFormPanel");
const admToggleOfferForm = $("#admToggleOfferForm");
const admCloseOfferForm  = $("#admCloseOfferForm");
const admCancelOfferForm = $("#admCancelOfferForm");

function openOfferForm() {
  if (!admOfferFormPanel) return;
  admOfferFormPanel.style.display = "block";
  admOfferFormPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  $("#offerTitle")?.focus();
}

function closeOfferForm() {
  if (!admOfferFormPanel) return;
  admOfferFormPanel.style.display = "none";
  showFeedback($("#offerFormError"), $("#offerFormSuccess"), "none");
}

admToggleOfferForm?.addEventListener("click", openOfferForm);
admCloseOfferForm?.addEventListener("click",  closeOfferForm);
admCancelOfferForm?.addEventListener("click", closeOfferForm);

// Create offer form submission
const addOfferForm = $("#addOfferForm");
const addOfferBtn  = $("#addOfferBtn");

addOfferForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const errEl  = $("#offerFormError");
  const succEl = $("#offerFormSuccess");
  showFeedback(errEl, succEl, "none");

  const title       = $("#offerTitle")?.value.trim();
  const description = $("#offerDescription")?.value.trim();
  const rawPartner  = $("#offerPartner")?.value.trim();
  const partnerId   = rawPartner === "" ? "Globale" : rawPartner;

  if (!title) {
    showFeedback(errEl, succEl, "error", "Il titolo dell'offerta è obbligatorio.");
    $("#offerTitle")?.focus();
    return;
  }

  setLoading(addOfferBtn, true);

  try {
    const data = await Api.post("/offers", { title, description, partnerId });

    if (data?.success) {
      showFeedback(errEl, succEl, "success");
      addOfferForm.reset();
      await Promise.all([loadOffers(), loadStats()]);
    } else {
      showFeedback(errEl, succEl, "error", data?.message || "Errore nella creazione dell'offerta.");
    }
  } catch {
    showFeedback(errEl, succEl, "error", "Errore di connessione. Riprova.");
  } finally {
    setLoading(addOfferBtn, false);
  }
});


/* ═══════════════════════════════════════════════════════════
   SECTION 11 — REDEMPTIONS MODULE
═══════════════════════════════════════════════════════════ */

const redemptionsTable = $("#moduleRedemptions .adm-table");
const redemptionsBody  = $("#redemptionsTableBody");
const redemptionsCount = $("#redemptionsCount");

export async function loadRedemptions() {
  if (!redemptionsBody) return;
  redemptionsBody.innerHTML = skeletonRows(4);

  try {
    const data = await Api.getPaginated("/redemptions", State.redemptions);
    if (!data) return;

    const rows = data.data || [];
    const meta = data.pagination;

    if (redemptionsCount && meta) {
      redemptionsCount.textContent = `${meta.totalItems.toLocaleString("it-IT")} utilizzi`;
    }

    if (!rows.length) {
      redemptionsBody.innerHTML = emptyRow(4, State.redemptions.search
        ? `Nessun utilizzo trovato per "${State.redemptions.search}".`
        : "Nessun utilizzo registrato.");
    } else {
      redemptionsBody.innerHTML = rows.map((r) => `
        <tr>
          <td class="adm-td-secondary">${esc(truncate(r.customerId, 26))}</td>
          <td>
            <span class="adm-badge adm-badge--neutral">${esc(r.partnerId)}</span>
          </td>
          <td class="adm-td-secondary">${esc(truncate(r.offerId, 26))}</td>
          <td class="adm-td-date">${fmtDate(r.redeemedAt)}</td>
        </tr>`).join("");
    }

    renderPagination(
      $("#redemptionsPaginationControls"),
      $("#redemptionsPaginationInfo"),
      meta,
      (p) => { State.redemptions.page = p; loadRedemptions(); }
    );

  } catch {
    redemptionsBody.innerHTML = emptyRow(4, "Errore nel caricamento utilizzi. Riprova.");
  }
}

// Search
const redemptionsSearchInput = $("#redemptionsSearch");
redemptionsSearchInput?.addEventListener("input", debounce(() => {
  State.redemptions.search = redemptionsSearchInput.value.trim();
  State.redemptions.page   = 1;
  loadRedemptions();
}, 380));

// Page size
$("#redemptionsPageSize")?.addEventListener("change", function () {
  State.redemptions.limit = parseInt(this.value, 10);
  State.redemptions.page  = 1;
  loadRedemptions();
});

// Sort
initSortableHeaders(redemptionsTable, State.redemptions, loadRedemptions);


// Sort
initSortableHeaders(redemptionsTable, State.redemptions, loadRedemptions);


/* ═══════════════════════════════════════════════════════════
   SECTION 12B — NEWSLETTER MODULE
═══════════════════════════════════════════════════════════ */

const newsletterTable = $("#moduleNewsletter .adm-table");
const newsletterBody  = $("#newsletterTableBody");
const newsletterCount = $("#newsletterCount");

export async function loadNewsletter() {
  if (!newsletterBody) return;
  newsletterBody.innerHTML = skeletonRows(5);

  try {
    const data = await Api.getPaginated("/newsletters", State.newsletter);
    if (!data) return;

    const rows = data.data || [];
    const meta = data.pagination;

    if (newsletterCount && meta) {
      newsletterCount.textContent = `${meta.totalItems.toLocaleString("it-IT")} iscritti`;
    }

    if (!rows.length) {
      newsletterBody.innerHTML = emptyRow(5, State.newsletter.search
        ? `Nessun iscritto trovato per "${State.newsletter.search}".`
        : "Nessun iscritto registrato.");
    } else {
      newsletterBody.innerHTML = rows.map((n) => `
        <tr>
          <td class="adm-td-name">${esc(n.email)}</td>
          <td>
            ${n.verified
              ? `<span class="adm-badge adm-badge--active">Verificato</span>`
              : `<span class="adm-badge adm-badge--pending">In attesa</span>`}
          </td>
          <td>
            ${n.subscribed
              ? `<span class="adm-badge adm-badge--active">Iscritto</span>`
              : `<span class="adm-badge adm-badge--inactive">Discritto</span>`}
          </td>
          <td class="adm-td-date">${fmtDate(n.createdAt)}</td>
          <td class="adm-td-actions">
            ${renderActionCell(n.email, "", [
              ...(n.verified ? [] : [{ label: "Invia verifica", icon: "fa-envelope", action: "resend-verification" }]),
              ...(n.subscribed ? [{ label: "Elimina iscrizione", icon: "fa-trash", action: "delete", danger: true }] : []),
            ])}
          </td>
        </tr>`).join("");
    }

    renderPagination(
      $("#newsletterPaginationControls"),
      $("#newsletterPaginationInfo"),
      meta,
      (p) => { State.newsletter.page = p; loadNewsletter(); }
    );

    wireActionMenus(newsletterBody, async (action, email) => {
      if (action === "resend-verification") {
        try {
          const res = await Api.post(`/newsletters/${encodeURIComponent(email)}/resend-verification`, {});
          showToast(res?.message || "Email di verifica inviata.", res?.success === false ? "error" : "success");
        } catch {
          showToast("Errore di connessione.", "error");
        }
      }

      if (action === "delete") {
        showConfirm(
          `Eliminare l'iscrizione di "${email}"?`,
          "L'iscritto verrà contrassegnato come disiscritto. I dati restano nel database e potranno essere rimossi definitivamente in un secondo momento per conformità GDPR.",
          async () => {
            try {
              const res = await Api.delete(`/newsletters/${encodeURIComponent(email)}`);
              if (res?.success) {
                showToast("Iscrizione rimossa.");
                await Promise.all([loadNewsletter(), loadStats()]);
              } else {
                showToast(res?.message || "Errore durante la rimozione.", "error");
              }
            } catch {
              showToast("Errore di connessione.", "error");
            }
          }
        );
      }
    });

  } catch {
    newsletterBody.innerHTML = emptyRow(5, "Errore nel caricamento newsletter. Riprova.");
  }
}

// Search
const newsletterSearchInput = $("#newsletterSearch");
newsletterSearchInput?.addEventListener("input", debounce(() => {
  State.newsletter.search = newsletterSearchInput.value.trim();
  State.newsletter.page   = 1;
  loadNewsletter();
}, 380));

// Verified filter
$("#newsletterVerifiedFilter")?.addEventListener("change", function () {
  State.newsletter.filters.verified = this.value;
  State.newsletter.page = 1;
  loadNewsletter();
});

// Subscribed filter
$("#newsletterSubscribedFilter")?.addEventListener("change", function () {
  State.newsletter.filters.subscribed = this.value;
  State.newsletter.page = 1;
  loadNewsletter();
});

// Page size
$("#newsletterPageSize")?.addEventListener("change", function () {
  State.newsletter.limit = parseInt(this.value, 10);
  State.newsletter.page  = 1;
  loadNewsletter();
});

// Sort
initSortableHeaders(newsletterTable, State.newsletter, loadNewsletter);


/* ═══════════════════════════════════════════════════════════
   SECTION 12C — CONTACTS MODULE (Contact Requests)
═══════════════════════════════════════════════════════════ */

const contactsTable = $("#moduleContacts .adm-table");
const contactsBody  = $("#contactsTableBody");
const contactsCount = $("#contactsCount");

// In-memory cache for the detail modal (same pattern as partner requests)
const _contactsCache = new Map();

const SOURCE_LABELS = {
  home:    "Homepage",
  loyalty: "Loyalty",
};

const CATEGORY_LABEL_MAP = {
  Gas:          "Gas",
  Electricity:  "Elettricità",
  Both:         "Entrambi",
  Cliente:      "Cliente",
  Partner:      "Partner",
  Info:         "Info",
};

export async function loadContacts() {
  if (!contactsBody) return;
  contactsBody.innerHTML = skeletonRows(8);

  try {
    const data = await Api.getPaginated("/contacts", State.contacts);
    if (!data) return;

    const rows = data.data || [];
    const meta = data.pagination;

    _contactsCache.clear();
    rows.forEach((r) => _contactsCache.set(r.id, r));

    if (contactsCount && meta) {
      contactsCount.textContent = `${meta.totalItems.toLocaleString("it-IT")} contatti`;
    }

    if (!rows.length) {
      contactsBody.innerHTML = emptyRow(8, State.contacts.search
        ? `Nessun contatto trovato per "${State.contacts.search}".`
        : "Nessun contatto registrato.");
    } else {
      contactsBody.innerHTML = rows.map((c) => `
        <tr>
          <td class="adm-td-name">${esc(c.lastName || "")} ${esc(c.firstName || "")}</td>
          <td class="adm-td-secondary">${esc(c.email)}</td>
          <td class="adm-td-secondary">${esc(c.phone || "—")}</td>
          <td>
            ${c.category
              ? `<span class="adm-badge adm-badge--neutral">${esc(CATEGORY_LABEL_MAP[c.category] || c.category)}</span>`
              : `<span class="adm-td-secondary">—</span>`}
          </td>
          <td>
            ${c.source
              ? `<span class="adm-badge adm-badge--neutral">${esc(SOURCE_LABELS[c.source] || c.source)}</span>`
              : `<span class="adm-td-secondary">—</span>`}
          </td>
          <td>
            ${c.verified
              ? `<span class="adm-badge adm-badge--active">Verificato</span>`
              : `<span class="adm-badge adm-badge--pending">In attesa</span>`}
            ${c.status === "contacted"
              ? `<div style="margin-top:3px;"><span class="adm-badge adm-badge--navy" style="font-size:0.6rem;">Contattato</span></div>`
              : c.status === "archived"
                ? `<div style="margin-top:3px;"><span class="adm-badge adm-badge--neutral" style="font-size:0.6rem;">Archiviato</span></div>`
                : ""}
          </td>
          <td class="adm-td-date">${fmtDate(c.createdAt)}</td>
          <td class="adm-td-actions">
            <div class="adm-row-actions">
              ${c.requestId
                ? `<button class="adm-btn adm-btn--secondary adm-btn--sm" data-contact-detail="${esc(c.id)}">
                     Dettagli
                   </button>`
                : ""}
              ${c.requestId
                ? renderActionCell(c.id, "", [
                    ...(c.status === "new" ? [{ label: "Segna come contattato", icon: "fa-check", action: "mark-contacted" }] : []),
                    ...(c.verified ? [] : [{ label: "Invia verifica", icon: "fa-envelope", action: "resend-verification" }]),
                    ...(c.status !== "archived" ? [{ label: "Archivia", icon: "fa-box-archive", action: "archive", danger: true }] : []),
                  ])
                : ""}
            </div>
          </td>
        </tr>`).join("");
    }

    renderPagination(
      $("#contactsPaginationControls"),
      $("#contactsPaginationInfo"),
      meta,
      (p) => { State.contacts.page = p; loadContacts(); }
    );

    // Wire detail buttons
    contactsBody.querySelectorAll("[data-contact-detail]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const c = _contactsCache.get(btn.dataset.contactDetail);
        if (c) openContactDetailModal(c);
      });
    });

    wireActionMenus(contactsBody, async (action, rowId) => {
      const c = _contactsCache.get(rowId);
      if (!c) return;

      if (action === "mark-contacted") {
        try {
          const res = await Api.patch(`/contacts/${encodeURIComponent(c.requestId)}/mark-contacted`, {});
          if (res?.success) {
            showToast("Contatto segnato come contattato.");
            await loadContacts();
          } else {
            showToast(res?.message || "Errore durante l'operazione.", "error");
          }
        } catch {
          showToast("Errore di connessione.", "error");
        }
      }

      if (action === "resend-verification") {
        try {
          const res = await Api.post(`/contacts/${encodeURIComponent(c.id)}/resend-verification`, {});
          showToast(res?.message || "Email di verifica inviata.", res?.success === false ? "error" : "success");
        } catch {
          showToast("Errore di connessione.", "error");
        }
      }

      if (action === "archive") {
        showConfirm(
          `Archiviare la richiesta di "${c.firstName || c.email}"?`,
          "La richiesta verrà nascosta dalla vista predefinita ma resterà consultabile dal database.",
          async () => {
            try {
              const res = await Api.patch(`/contacts/${encodeURIComponent(c.requestId)}/archive`, {});
              if (res?.success) {
                showToast("Richiesta archiviata.");
                await loadContacts();
              } else {
                showToast(res?.message || "Errore durante l'archiviazione.", "error");
              }
            } catch {
              showToast("Errore di connessione.", "error");
            }
          }
        );
      }
    });

  } catch {
    contactsBody.innerHTML = emptyRow(8, "Errore nel caricamento contatti. Riprova.");
  }
}

// Search
const contactsSearchInput = $("#contactsSearch");
contactsSearchInput?.addEventListener("input", debounce(() => {
  State.contacts.search = contactsSearchInput.value.trim();
  State.contacts.page   = 1;
  loadContacts();
}, 380));

// Verified filter
$("#contactsVerifiedFilter")?.addEventListener("change", function () {
  State.contacts.filters.verified = this.value;
  State.contacts.page = 1;
  loadContacts();
});

// Source filter
$("#contactsSourceFilter")?.addEventListener("change", function () {
  State.contacts.filters.source = this.value;
  State.contacts.page = 1;
  loadContacts();
});

// Page size
$("#contactsPageSize")?.addEventListener("change", function () {
  State.contacts.limit = parseInt(this.value, 10);
  State.contacts.page  = 1;
  loadContacts();
});

// Sort
initSortableHeaders(contactsTable, State.contacts, loadContacts);

// Contact detail modal
const admContactDetailModal = $("#admContactDetailModal");
const admContactDetailBody  = $("#admContactDetailBody");
const admContactDetailClose = $("#admContactDetailClose");

function openContactDetailModal(c) {
  if (!admContactDetailModal) return;

  const rows = [
    ["Nome",           `${esc(c.firstName || "")} ${esc(c.lastName || "")}`],
    ["Email",          `<a href="mailto:${esc(c.email)}" style="color:var(--loy-gold-dark);">${esc(c.email)}</a>`],
    ["Telefono",       esc(c.phone || "Non fornito")],
    ["Tipo richiesta", esc(CATEGORY_LABEL_MAP[c.category] || c.category || "—")],
    ["Origine",        esc(SOURCE_LABELS[c.source] || c.source || "—")],
    ["Verifica",       c.verified ? "✅ Verificato" : "⏳ In attesa"],
    ["Orario pref.",   esc(c.preferredContactTime || "Non specificato")],
    ["Messaggio",      `<span style="white-space:pre-wrap;">${esc(c.message || "Nessun messaggio")}</span>`],
    ["Data richiesta", fmtDate(c.requestCreatedAt || c.createdAt)],
  ];

  if (admContactDetailBody) {
    admContactDetailBody.innerHTML = `
      <table style="width:100%;border-collapse:collapse;">
        ${rows.map(([key, val]) => `
          <tr style="border-bottom:1px solid var(--loy-border);">
            <td style="padding:8px 0;width:120px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--loy-text-sec);vertical-align:top;">${key}</td>
            <td style="padding:8px 0;color:var(--loy-text);">${val}</td>
          </tr>`).join("")}
      </table>`;
  }

  admContactDetailModal.classList.add("open");
  admContactDetailClose?.focus();
}

admContactDetailClose?.addEventListener("click", () => admContactDetailModal?.classList.remove("open"));
admContactDetailModal?.addEventListener("click", (e) => {
  if (e.target === admContactDetailModal) admContactDetailModal.classList.remove("open");
});


/* ═══════════════════════════════════════════════════════════
   SECTION 12D — SIMULATOR MODULE
═══════════════════════════════════════════════════════════ */

const simulatorTable = $("#moduleSimulator .adm-table");
const simulatorBody  = $("#simulatorTableBody");
const simulatorCount = $("#simulatorCount");

const _simulatorCache = new Map();

const ENERGY_SOURCE_LABELS = {
  gas:         "Gas",
  electricity: "Elettricità",
  both:        "Entrambi",
};

export async function loadSimulator() {
  if (!simulatorBody) return;
  simulatorBody.innerHTML = skeletonRows(8);

  try {
    const data = await Api.getPaginated("/simulator", State.simulator);
    if (!data) return;

    const rows = data.data || [];
    const meta = data.pagination;

    _simulatorCache.clear();
    rows.forEach((r) => _simulatorCache.set(r.id, r));

    if (simulatorCount && meta) {
      simulatorCount.textContent = `${meta.totalItems.toLocaleString("it-IT")} simulazioni`;
    }

    if (!rows.length) {
      simulatorBody.innerHTML = emptyRow(8, State.simulator.search
        ? `Nessun lead trovato per "${State.simulator.search}".`
        : "Nessuna simulazione registrata.");
    } else {
      simulatorBody.innerHTML = rows.map((s) => `
        <tr>
          <td class="adm-td-secondary">${esc(s.contactEmail || "Anonimo")}</td>
          <td class="adm-td-secondary">${esc(s.provider || "—")}</td>
          <td>
            <span class="adm-badge adm-badge--neutral">
              ${esc(ENERGY_SOURCE_LABELS[s.energySource] || s.energySource || "—")}
            </span>
          </td>
          <td class="adm-td-secondary">
            ${s.estimatedMonthlySavings
              ? `<strong>€${Number(s.estimatedMonthlySavings).toLocaleString("it-IT")}/mese</strong>`
              : "—"}
          </td>
          <td class="adm-td-secondary">
            ${s.annualBill
              ? `€${Number(s.annualBill).toLocaleString("it-IT")}`
              : "—"}
          </td>
          <td>
            ${s.contactId
              ? s.contactVerified
                ? `<span class="adm-badge adm-badge--active">Verificato</span>`
                : `<span class="adm-badge adm-badge--pending">In attesa</span>`
              : `<span class="adm-badge adm-badge--neutral">Anonimo</span>`}
            ${s.status === "contacted"
              ? `<div style="margin-top:3px;"><span class="adm-badge adm-badge--navy" style="font-size:0.6rem;">Contattato</span></div>`
              : ""}
          </td>
          <td class="adm-td-date">${fmtDate(s.createdAt)}</td>
          <td class="adm-td-actions">
            <div class="adm-row-actions">
              <button class="adm-btn adm-btn--secondary adm-btn--sm" data-simulator-detail="${esc(s.id)}">
                Dettagli
              </button>
              ${renderActionCell(s.id, "", [
                ...(s.status === "new" ? [{ label: "Segna come contattato", icon: "fa-check", action: "mark-contacted" }] : []),
                { label: "Archivia", icon: "fa-box-archive", action: "archive", danger: true },
              ])}
            </div>
          </td>
        </tr>`).join("");
    }

    renderPagination(
      $("#simulatorPaginationControls"),
      $("#simulatorPaginationInfo"),
      meta,
      (p) => { State.simulator.page = p; loadSimulator(); }
    );

    // Wire detail buttons
    simulatorBody.querySelectorAll("[data-simulator-detail]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const s = _simulatorCache.get(btn.dataset.simulatorDetail);
        if (s) openSimulatorDetailModal(s);
      });
    });

    wireActionMenus(simulatorBody, async (action, rowId) => {
      const s = _simulatorCache.get(rowId);
      if (!s) return;

      if (action === "mark-contacted") {
        try {
          const res = await Api.patch(`/simulator/${encodeURIComponent(rowId)}/mark-contacted`, {});
          if (res?.success) {
            showToast("Lead segnato come contattato.");
            await loadSimulator();
          } else {
            showToast(res?.message || "Errore durante l'operazione.", "error");
          }
        } catch {
          showToast("Errore di connessione.", "error");
        }
      }

      if (action === "archive") {
        showConfirm(
          "Archiviare questa simulazione?",
          "La simulazione verrà nascosta dalla vista predefinita ma resterà consultabile dal database.",
          async () => {
            try {
              const res = await Api.patch(`/simulator/${encodeURIComponent(rowId)}/archive`, {});
              if (res?.success) {
                showToast("Simulazione archiviata.");
                await Promise.all([loadSimulator(), loadStats()]);
              } else {
                showToast(res?.message || "Errore durante l'archiviazione.", "error");
              }
            } catch {
              showToast("Errore di connessione.", "error");
            }
          }
        );
      }
    });

  } catch {
    simulatorBody.innerHTML = emptyRow(8, "Errore nel caricamento simulazioni. Riprova.");
  }
}

// Search
const simulatorSearchInput = $("#simulatorSearch");
simulatorSearchInput?.addEventListener("input", debounce(() => {
  State.simulator.search = simulatorSearchInput.value.trim();
  State.simulator.page   = 1;
  loadSimulator();
}, 380));

// Energy source filter
$("#simulatorEnergyFilter")?.addEventListener("change", function () {
  State.simulator.filters.energySource = this.value;
  State.simulator.page = 1;
  loadSimulator();
});

// Page size
$("#simulatorPageSize")?.addEventListener("change", function () {
  State.simulator.limit = parseInt(this.value, 10);
  State.simulator.page  = 1;
  loadSimulator();
});

// Sort
initSortableHeaders(simulatorTable, State.simulator, loadSimulator);

// Simulator detail modal
const admSimulatorDetailModal = $("#admSimulatorDetailModal");
const admSimulatorDetailBody  = $("#admSimulatorDetailBody");
const admSimulatorDetailClose = $("#admSimulatorDetailClose");

function openSimulatorDetailModal(s) {
  if (!admSimulatorDetailModal) return;

  const rows = [
    ["Email",        esc(s.contactEmail || "Anonimo")],
    ["Telefono",     esc(s.contactPhone || "Non fornito")],
    ["Verifica",     s.contactId
                       ? s.contactVerified ? "✅ Verificato" : "⏳ In attesa"
                       : "— Anonimo"],
    ["Fonte",        esc(ENERGY_SOURCE_LABELS[s.energySource] || s.energySource || "—")],
    ["Tipo abitaz.", esc(s.housingType || "—")],
    ["Superficie",   s.surface ? `${s.surface} m²` : "—"],
    ["Persone",      esc(String(s.peopleCount || "—"))],
    ["Zona",         esc(s.location || "—")],
    ["Provider att.",esc(s.provider || "—")],
    ["Bolletta ann.",s.annualBill ? `€${Number(s.annualBill).toLocaleString("it-IT")}` : "—"],
    ["kWh elettr.",  s.electricityKwh ? `${Number(s.electricityKwh).toLocaleString("it-IT")} kWh` : "—"],
    ["kWh gas",      s.gasKwh ? `${Number(s.gasKwh).toLocaleString("it-IT")} kWh` : "—"],
    ["Risparmio/mese", s.estimatedMonthlySavings
                         ? `<strong>€${Number(s.estimatedMonthlySavings).toLocaleString("it-IT")}</strong>`
                         : "—"],
    ["Data",         fmtDate(s.createdAt)],
  ];

  if (admSimulatorDetailBody) {
    admSimulatorDetailBody.innerHTML = `
      <table style="width:100%;border-collapse:collapse;">
        ${rows.map(([key, val]) => `
          <tr style="border-bottom:1px solid var(--loy-border);">
            <td style="padding:8px 0;width:130px;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--loy-text-sec);vertical-align:top;">${key}</td>
            <td style="padding:8px 0;color:var(--loy-text);">${val}</td>
          </tr>`).join("")}
      </table>`;
  }

  admSimulatorDetailModal.classList.add("open");
  admSimulatorDetailClose?.focus();
}

admSimulatorDetailClose?.addEventListener("click", () => admSimulatorDetailModal?.classList.remove("open"));
admSimulatorDetailModal?.addEventListener("click", (e) => {
  if (e.target === admSimulatorDetailModal) admSimulatorDetailModal.classList.remove("open");
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    admContactDetailModal?.classList.remove("open");
    admSimulatorDetailModal?.classList.remove("open");
  }
});