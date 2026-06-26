/**
 * js/features/loyalty/admin/admin.js
 *
 * M&M Consulting — Admin Console
 *
 * Architecture:
 *   - No global state pollution: all state lives in module-scoped objects
 *   - Each data module (customers, partners, offers, redemptions) owns
 *     its own state slice: { page, limit, search, sortBy, sortOrder, filters }
 *   - A shared ApiClient handles all fetch calls with CSRF headers + 401 guard
 *   - A shared Pagination renderer produces consistent pagination UI
 *   - A shared Table renderer with XSS escaping for all cell content
 *   - Sidebar navigation drives module switching (replaces tab system)
 *   - Search inputs debounced 380ms before API call
 *   - All strings in Italian
 *
 * Drop-in replacement for the previous admin.js.
 * Requires: /assets/css/loyalty.css + /assets/css/admin.css
 */

"use strict";

import { $, $$ } from "../../../core/dom.js";
import { setLoading } from "../../../core/loyaltyUtils.js";


/* ═══════════════════════════════════════════════════════════
   SECTION 1 — UTILITIES
═══════════════════════════════════════════════════════════ */

/** XSS-safe HTML escaping — used on every cell value */
function esc(val) {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Format ISO date string to Italian locale */
function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("it-IT", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  } catch { return String(iso); }
}

/** Truncate long strings for display */
function truncate(str, max = 32) {
  const s = String(str ?? "");
  return s.length > max ? s.slice(0, max) + "…" : s;
}

/** Debounce — returns a function that delays fn by ms */
function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

/** Status badge HTML */
function badgeActive(active) {
  return active
    ? `<span class="adm-badge adm-badge--active">Attivo</span>`
    : `<span class="adm-badge adm-badge--inactive">Sospeso</span>`;
}

/** Empty state row */
function emptyRow(colspan, msg = "Nessun dato disponibile.") {
  return `
    <tr>
      <td colspan="${colspan}" style="padding:0;">
        <div class="adm-empty">
          <span class="adm-empty-sub">${esc(msg)}</span>
        </div>
      </td>
    </tr>`;
}

/** Skeleton loading rows */
function skeletonRows(colspan, count = 5) {
  return Array.from({ length: count }, () => `
    <tr class="adm-skeleton-row">
      <td colspan="${colspan}" style="padding:14px 16px;">
        <div class="adm-skeleton" style="width:${60 + Math.random() * 35 | 0}%;"></div>
      </td>
    </tr>`).join("");
}

/** Show/hide adm-feedback elements */
function showFeedback(errorEl, successEl, type, msg = "") {
  if (!errorEl || !successEl) return;
  if (type === "error") {
    successEl.classList.remove("visible");
    errorEl.querySelector("span:last-child").textContent = msg;
    errorEl.classList.add("visible");
    errorEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } else if (type === "success") {
    errorEl.classList.remove("visible");
    if (msg) successEl.querySelector("span:last-child").textContent = msg;
    successEl.classList.add("visible");
  } else {
    errorEl.classList.remove("visible");
    successEl.classList.remove("visible");
  }
}


/* ═══════════════════════════════════════════════════════════
   SECTION 2 — API CLIENT
   Single fetch wrapper: CSRF headers, JSON, 401 redirect
═══════════════════════════════════════════════════════════ */

const Api = {
  _base: "/api/loyalty/admin",

  _headers(mutating = false) {
    const h = { "Accept": "application/json" };
    if (mutating) {
      h["Content-Type"] = "application/json";
      h["X-Requested-With"] = "XMLHttpRequest";
    }
    return h;
  },

  async _fetch(path, opts = {}) {
    const res = await fetch(this._base + path, {
      credentials: "same-origin",
      ...opts,
    });

    if (res.status === 401) {
      window.location.replace("/loyalty/admin/login.html");
      return null;
    }

    return res;
  },

  async get(path) {
    const res = await this._fetch(path, { headers: this._headers() });
    if (!res) return null;
    return res.json();
  },

  async post(path, body) {
    const res = await this._fetch(path, {
      method: "POST",
      headers: this._headers(true),
      body: JSON.stringify(body),
    });
    if (!res) return null;
    return res.json();
  },

  async patch(path, body) {
    const res = await this._fetch(path, {
      method: "PATCH",
      headers: this._headers(true),
      body: JSON.stringify(body),
    });
    if (!res) return null;
    return res.json();
  },

  /**
   * Paginated GET — appends ?page=&limit=&search=&sortBy=&sortOrder=&filters
   * Matches the paginationMiddleware contract from the backend.
   */
  async getPaginated(path, { page = 1, limit = 20, search = "", sortBy, sortOrder = "desc", filters = {} } = {}) {
    const params = new URLSearchParams({ page, limit, sortOrder });
    if (search)  params.set("search",  search);
    if (sortBy)  params.set("sortBy",  sortBy);
    // Spread entity-specific filters (active, partnerId, category…)
    for (const [k, v] of Object.entries(filters)) {
      if (v !== "" && v !== undefined && v !== null) params.set(k, v);
    }
    return this.get(`${path}?${params}`);
  },
};


/* ═══════════════════════════════════════════════════════════
   SECTION 3 — PAGINATION COMPONENT
   Renders pagination controls from a pagination meta object.
   Calls onChange(newPage) when a page button is clicked.
═══════════════════════════════════════════════════════════ */

function renderPagination(containerEl, infoEl, meta, onChange) {
  if (!containerEl || !meta) return;

  const { page, limit, totalItems, totalPages, hasNext, hasPrevious } = meta;

  // Info text
  if (infoEl) {
    const from = totalItems === 0 ? 0 : (page - 1) * limit + 1;
    const to   = Math.min(page * limit, totalItems);
    infoEl.textContent = totalItems === 0
      ? "Nessun risultato"
      : `${from}–${to} di ${totalItems.toLocaleString("it-IT")}`;
  }

  // Controls
  const buttons = [];

  // Prev
  buttons.push(`
    <button
      class="adm-pagination-btn"
      data-page="${page - 1}"
      ${!hasPrevious ? "disabled" : ""}
      aria-label="Pagina precedente"
    >
      <i class="fa fa-chevron-left" aria-hidden="true"></i>
    </button>`);

  // Page numbers — window of 5 around current
  const pages = buildPageWindow(page, totalPages);
  let prevP = null;
  for (const p of pages) {
    if (prevP !== null && p - prevP > 1) {
      buttons.push(`<span class="adm-pagination-ellipsis" aria-hidden="true">…</span>`);
    }
    buttons.push(`
      <button
        class="adm-pagination-btn ${p === page ? "active" : ""}"
        data-page="${p}"
        aria-label="Pagina ${p}"
        ${p === page ? 'aria-current="page"' : ""}
      >${p}</button>`);
    prevP = p;
  }

  // Next
  buttons.push(`
    <button
      class="adm-pagination-btn"
      data-page="${page + 1}"
      ${!hasNext ? "disabled" : ""}
      aria-label="Pagina successiva"
    >
      <i class="fa fa-chevron-right" aria-hidden="true"></i>
    </button>`);

  containerEl.innerHTML = buttons.join("");

  // Wire click handlers
  containerEl.querySelectorAll(".adm-pagination-btn[data-page]").forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener("click", () => {
      const p = parseInt(btn.dataset.page, 10);
      if (p >= 1 && p <= totalPages && p !== page) onChange(p);
    });
  });
}

/** Build an array of page numbers to show (always include 1, last, and window around current) */
function buildPageWindow(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total]);
  for (let i = Math.max(2, current - 2); i <= Math.min(total - 1, current + 2); i++) {
    pages.add(i);
  }
  return [...pages].sort((a, b) => a - b);
}


/* ═══════════════════════════════════════════════════════════
   SECTION 4 — MODULE STATE
   Each module has its own isolated state object.
   Shape mirrors the paginationMiddleware req.pagination contract.
═══════════════════════════════════════════════════════════ */

function makeState(defaults = {}) {
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

const State = {
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

const MODULE_LABELS = {
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
function switchModule(key) {
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
   SECTION 6 — SORTABLE COLUMN HEADERS
   Makes th.adm-th-sortable toggle sortBy / sortOrder on click.
   Calls the provided onChange(sortBy, sortOrder) callback.
═══════════════════════════════════════════════════════════ */

function initSortableHeaders(tableEl, state, onChange) {
  if (!tableEl) return;
  tableEl.querySelectorAll(".adm-th-sortable[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const col = th.dataset.sort;
      const newOrder = (state.sortBy === col && state.sortOrder === "desc") ? "asc" : "desc";
      state.sortBy    = col;
      state.sortOrder = newOrder;

      // Update visual state
      tableEl.querySelectorAll(".adm-th-sortable").forEach((el) => {
        el.classList.remove("sorted");
        const icon = el.querySelector(".adm-th-sort-icon");
        if (icon) icon.textContent = "↕";
      });
      th.classList.add("sorted");
      const icon = th.querySelector(".adm-th-sort-icon");
      if (icon) icon.textContent = newOrder === "asc" ? "↑" : "↓";

      state.page = 1;
      onChange();
    });
  });
}


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
async function loadStats() {
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
async function loadDashboard() {
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

async function loadCustomers() {
  if (!customersBody) return;
  customersBody.innerHTML = skeletonRows(5);

  try {
    const data = await Api.getPaginated("/customers", State.customers);
    if (!data) return;

    const rows  = data.data || [];
    const meta  = data.pagination;

    // Update count label
    if (customersCount && meta) {
      customersCount.textContent = `${meta.totalItems.toLocaleString("it-IT")} clienti`;
    }

    if (!rows.length) {
      customersBody.innerHTML = emptyRow(5, State.customers.search
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
        </tr>`).join("");
    }

    // Render pagination
    renderPagination(
      $("#customersPaginationControls"),
      $("#customersPaginationInfo"),
      meta,
      (p) => { State.customers.page = p; loadCustomers(); }
    );

  } catch {
    customersBody.innerHTML = emptyRow(5, "Errore nel caricamento clienti. Riprova.");
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

async function loadPartners() {
  if (!partnersBody) return;
  partnersBody.innerHTML = skeletonRows(7);

  try {
    const data = await Api.getPaginated("/partners", State.partners);
    if (!data) return;

    const rows = data.data || [];
    const meta = data.pagination;

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
              ${p.active
                ? `<button class="adm-btn adm-btn--danger adm-btn--sm" data-toggle-partner="${esc(p.id)}" data-active="false">
                     Sospendi
                   </button>`
                : `<button class="adm-btn adm-btn--success adm-btn--sm" data-toggle-partner="${esc(p.id)}" data-active="true">
                     Attiva
                   </button>`}
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

    // Wire activate/suspend toggle buttons
    partnersBody.querySelectorAll("[data-toggle-partner]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id     = btn.dataset.togglePartner;
        const active = btn.dataset.active === "true";
        showConfirm(
          active ? `Attivare il partner "${id}"?` : `Sospendere il partner "${id}"?`,
          active ? "Il partner potrà nuovamente accedere alla dashboard." : "Il partner non potrà accedere fino alla riattivazione.",
          async () => togglePartnerActive(id, active)
        );
      });
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
function setPartnerToggle(active) {
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
function fillPartnerForm(d = {}) {
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

function openPartnerDrawer() {
  pfDrawerBackdrop?.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closePartnerDrawer() {
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
function openCreatePartnerDrawer() {
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
async function openEditPartnerDrawer(partnerId) {
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
function openApproveRequestDrawer(requestObj) {
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

async function loadPartnerRequests() {
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

async function loadOffers() {
  if (!offersBody) return;
  offersBody.innerHTML = skeletonRows(5);

  try {
    const data = await Api.getPaginated("/offers", State.offers);
    if (!data) return;

    const rows = data.data || [];
    const meta = data.pagination;

    if (offersCount && meta) {
      offersCount.textContent = `${meta.totalItems.toLocaleString("it-IT")} offerte`;
    }

    if (!rows.length) {
      offersBody.innerHTML = emptyRow(5, State.offers.search
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
        </tr>`).join("");
    }

    renderPagination(
      $("#offersPaginationControls"),
      $("#offersPaginationInfo"),
      meta,
      (p) => { State.offers.page = p; loadOffers(); }
    );

  } catch {
    offersBody.innerHTML = emptyRow(5, "Errore nel caricamento offerte. Riprova.");
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

async function loadRedemptions() {
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

async function loadNewsletter() {
  if (!newsletterBody) return;
  newsletterBody.innerHTML = skeletonRows(4);

  try {
    const data = await Api.getPaginated("/newsletters", State.newsletter);
    if (!data) return;

    const rows = data.data || [];
    const meta = data.pagination;

    if (newsletterCount && meta) {
      newsletterCount.textContent = `${meta.totalItems.toLocaleString("it-IT")} iscritti`;
    }

    if (!rows.length) {
      newsletterBody.innerHTML = emptyRow(4, State.newsletter.search
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
        </tr>`).join("");
    }

    renderPagination(
      $("#newsletterPaginationControls"),
      $("#newsletterPaginationInfo"),
      meta,
      (p) => { State.newsletter.page = p; loadNewsletter(); }
    );

  } catch {
    newsletterBody.innerHTML = emptyRow(4, "Errore nel caricamento newsletter. Riprova.");
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

async function loadContacts() {
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
          </td>
          <td class="adm-td-date">${fmtDate(c.createdAt)}</td>
          <td class="adm-td-actions">
            ${c.requestId
              ? `<button class="adm-btn adm-btn--secondary adm-btn--sm" data-contact-detail="${esc(c.id)}">
                   Dettagli
                 </button>`
              : "—"}
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

async function loadSimulator() {
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
          </td>
          <td class="adm-td-date">${fmtDate(s.createdAt)}</td>
          <td class="adm-td-actions">
            <button class="adm-btn adm-btn--secondary adm-btn--sm" data-simulator-detail="${esc(s.id)}">
              Dettagli
            </button>
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


/* ═══════════════════════════════════════════════════════════
   SECTION 12 — CONFIRM MODAL
   Generic confirmation dialog. Replaces browser alert().
═══════════════════════════════════════════════════════════ */

const admConfirmModal  = $("#admConfirmModal");
const admConfirmTitle  = $("#admConfirmTitle");
const admConfirmBody   = $("#admConfirmBody");
const admConfirmCancel = $("#admConfirmCancel");
const admConfirmOk     = $("#admConfirmOk");
let   _confirmCallback = null;

function showConfirm(title, body, onConfirm) {
  if (!admConfirmModal) { onConfirm(); return; }
  if (admConfirmTitle) admConfirmTitle.textContent = title;
  if (admConfirmBody)  admConfirmBody.textContent  = body;
  _confirmCallback = onConfirm;
  admConfirmModal.classList.add("open");
  admConfirmOk?.focus();
}

function closeConfirm() {
  admConfirmModal?.classList.remove("open");
  _confirmCallback = null;
}

admConfirmCancel?.addEventListener("click", closeConfirm);
admConfirmOk?.addEventListener("click", () => {
  const cb = _confirmCallback;
  closeConfirm();
  if (typeof cb === "function") cb();
});

admConfirmModal?.addEventListener("click", (e) => {
  if (e.target === admConfirmModal) closeConfirm();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && admConfirmModal?.classList.contains("open")) {
    closeConfirm();
  }
});


/* ═══════════════════════════════════════════════════════════
   SECTION 13 — BOOT
   Verify session then load the default module (dashboard).
═══════════════════════════════════════════════════════════ */

async function boot() {
  // Verify session — will redirect to login if 401
  const session = await Api.get("/session");
  if (!session) return; // redirect already triggered

  // Set admin name in topbar
  const nameEl = $("#admTopbarUser");
  if (nameEl && session.data?.email) {
    nameEl.textContent = session.data.email.split("@")[0];
  }

  // Load default module
  switchModule("dashboard");
}

boot();