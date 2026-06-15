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
  customers:   makeState(),
  partners:    makeState(),
  offers:      makeState(),
  redemptions: makeState({ sortBy: "redeemedAt" }),
};


/* ═══════════════════════════════════════════════════════════
   SECTION 5 — NAVIGATION / SIDEBAR
═══════════════════════════════════════════════════════════ */

const admSidebar  = $("#admSidebar");
const admOverlay  = $("#admOverlay");
const admBurger   = $("#admBurger");
const admBreadcrumbCurrent = $("#admBreadcrumbCurrent");

const MODULE_LABELS = {
  dashboard:   "Dashboard",
  customers:   "Clienti",
  partners:    "Partner",
  offers:      "Offerte",
  redemptions: "Utilizzi",
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
  } else if (key === "offers") {
    loadOffers();
  } else if (key === "redemptions") {
    loadRedemptions();
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
    const [cData, pData, oData, rData] = await Promise.all([
      Api.getPaginated("/customers",   { limit: 1 }),
      Api.getPaginated("/partners",    { limit: 1, filters: { active: "true" } }),
      Api.getPaginated("/offers",      { limit: 1, filters: { active: "true" } }),
      Api.getPaginated("/redemptions", { limit: 1 }),
    ]);

    const cTotal = cData?.pagination?.totalItems ?? "—";
    const pTotal = pData?.pagination?.totalItems ?? "—";
    const oTotal = oData?.pagination?.totalItems ?? "—";
    const rTotal = rData?.pagination?.totalItems ?? "—";

    if (statCustomers)   statCustomers.textContent   = cTotal;
    if (statPartners)    statPartners.textContent     = pTotal;
    if (statOffers)      statOffers.textContent       = oTotal;
    if (statRedemptions) statRedemptions.textContent  = rTotal;

    // Sidebar counts
    const nc = $("#navCountCustomers");
    const np = $("#navCountPartners");
    const no = $("#navCountOffers");
    const nr = $("#navCountRedemptions");
    if (nc) nc.textContent = cTotal;
    if (np) np.textContent = pTotal;
    if (no) no.textContent = oTotal;
    if (nr) nr.textContent = rTotal;

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
   SECTION 9B — PARTNER FORM DRAWER (CREATE / EDIT)

   Single drawer component for both flows:
     - Create: openCreatePartnerDrawer()
         ID Partner + Password temporanea visible
         Stato (active toggle) hidden
     - Edit:   openEditPartnerDrawer(partnerId)
         ID Partner + Password temporanea hidden
         Stato visible, fields pre-filled via
         GET /admin/partners/:id (full record —
         the paginated list response is lean)

   ID auto-slug: while creating, the ID field tracks
   the business name via slugify() until the admin
   edits the ID field manually.
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

let pfMode            = "create"; // 'create' | 'edit'
let pfEditingId       = null;
let pfActiveState     = true;

/** Set the active/suspended toggle visual + internal state */
function setPartnerToggle(active) {
  pfActiveState = active;
  pfStatusToggle?.setAttribute("aria-checked", String(active));
  pfStatusToggle?.classList.toggle("on", active);
  if (pfStatusLabel) pfStatusLabel.textContent = active ? "Attivo" : "Sospeso";
}

/** Reset form fields + feedback + internal flags */
function resetPartnerForm() {
  pfForm?.reset();
  setPartnerToggle(true);
  showFeedback(pfErrorEl, pfSuccessEl, "none");
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
 * - ID Partner + Password temporanea visible
 * - Stato hidden
 * - ID auto-slugs from the business name
 */
function openCreatePartnerDrawer() {
  pfMode      = "create";
  pfEditingId = null;
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
 * Open the drawer in EDIT mode for an existing partner.
 * Fetches the full record (GET /admin/partners/:id) since
 * the paginated list response omits notes/description/etc.
 *
 * - ID Partner + Password temporanea hidden
 * - Stato visible, pre-filled from the record
 *
 * @param {string} partnerId
 */
async function openEditPartnerDrawer(partnerId) {
  pfMode      = "edit";
  pfEditingId = partnerId;
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

    $("#pfName").value            = p.name             || "";
    $("#pfLegalName").value       = p.legalName         || "";
    $("#pfVat").value              = p.vatNumber         || "";
    $("#pfCategory").value         = p.category          || "";
    $("#pfEmail").value             = p.email             || "";
    $("#pfPhone").value             = p.phone             || "";
    $("#pfWebsite").value           = p.website           || "";
    $("#pfAddress").value           = p.address           || "";
    $("#pfCity").value               = p.city               || "";
    $("#pfPostalCode").value         = p.postalCode         || "";
    $("#pfDescription").value        = p.description        || "";
    $("#pfOfferDescription").value   = p.offerDescription    || "";
    $("#pfNotes").value               = p.notes               || "";

    setPartnerToggle(Boolean(p.active));

  } catch {
    showFeedback(pfErrorEl, pfSuccessEl, "error", "Errore di connessione. Riprova.");
  } finally {
    setLoading(pfSubmitBtn, false);
    if (pfSubmitBtn) pfSubmitBtn.disabled = false;
  }
}

// "Nuovo partner" button (page header) — opens create drawer
$("#admTogglePartnerForm")?.addEventListener("click", openCreatePartnerDrawer);

// Submit — POST for create, PATCH for edit
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

  // Shared validation
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

      data = await Api.post("/partners", { tempPassword, ...payload });

    } else {
      payload.active = pfActiveState;
      data = await Api.patch(`/partners/${encodeURIComponent(pfEditingId)}`, payload);
    }

    if (data?.success) {
      showFeedback(pfErrorEl, pfSuccessEl, "success",
        pfMode === "create"
          ? `Partner "${esc(payload.name)}" creato con successo. Dovrà impostare la propria password al primo accesso.`
          : "Modifiche salvate con successo.");

      await Promise.all([loadPartners(), loadStats()]);

      // Brief delay so the admin sees the confirmation before the drawer closes
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