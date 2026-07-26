"use strict";
/**
 * admin/ui.js
 *
 * Shared UI infrastructure for the admin console.
 * Imported by modules.js, drawers.js, and admin.js.
 *
 * Exports:
 *   DOM helpers:   $, $$, esc, fmtDate, truncate, debounce
 *   Feedback:      setLoading, showFeedback, showToast, showConfirm
 *   Badges:        badgeActive, skeletonRows, emptyRow
 *   Action menus:  renderActionCell, wireActionMenus
 *   API client:    Api
 *   Pagination:    renderPagination, buildPageWindow
 *   Sortable:      initSortableHeaders
 */

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

// Re-export core utilities so modules.js and drawers.js only need
// to import from "./ui.js" — one dependency instead of three.
export { $, $$ };
export { setLoading };


/* ═══════════════════════════════════════════════════════════
   SECTION 1 — UTILITIES
═══════════════════════════════════════════════════════════ */

/** XSS-safe HTML escaping — used on every cell value */
export function esc(val) {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Format ISO date string to Italian locale */
export function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("it-IT", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  } catch { return String(iso); }
}

/** Truncate long strings for display */
export function truncate(str, max = 32) {
  const s = String(str ?? "");
  return s.length > max ? s.slice(0, max) + "…" : s;
}

/** Debounce — returns a function that delays fn by ms */
export function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

/** Status badge HTML */
export function badgeActive(active) {
  return active
    ? `<span class="adm-badge adm-badge--active">Attivo</span>`
    : `<span class="adm-badge adm-badge--inactive">Sospeso</span>`;
}

/** Empty state row */
export function emptyRow(colspan, msg = "Nessun dato disponibile.") {
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
export function skeletonRows(colspan, count = 5) {
  return Array.from({ length: count }, () => `
    <tr class="adm-skeleton-row">
      <td colspan="${colspan}" style="padding:14px 16px;">
        <div class="adm-skeleton" style="width:${60 + Math.random() * 35 | 0}%;"></div>
      </td>
    </tr>`).join("");
}

/** Show/hide adm-feedback elements */
export function showFeedback(errorEl, successEl, type, msg = "") {
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

/**
 * Lightweight toast — used by all new action handlers
 * (mark contacted, archive, resend verification, delete, etc.)
 * that don't have a dedicated form error/success pair to
 * target via showFeedback(). Self-removing, no dependencies.
 */
export function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed; bottom: 20px; right: 20px; z-index: 9999;
    background: ${type === "error" ? "#C0392B" : "var(--loy-navy)"};
    color: #fff; padding: 11px 18px; border-radius: 8px;
    font-family: var(--loy-font-display); font-size: 0.82rem; font-weight: 600;
    box-shadow: var(--loy-shadow-lg); opacity: 0; transform: translateY(8px);
    transition: opacity 0.2s, transform 0.2s; max-width: 320px;
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    setTimeout(() => toast.remove(), 200);
  }, 3200);
}

/**
 * Builds the markup for a row's action cell: one optional
 * primary inline button + a "⋮" overflow menu. Used identically
 * by every module (customers, partners, partner requests,
 * contacts, newsletters, simulator) so the pattern never drifts.
 *
 * @param {string}  rowId      — unique id for this row, embedded
 *                                in data attributes for click delegation
 * @param {string}  primaryBtn — full HTML for the one inline button,
 *                                or "" to show only the overflow menu
 * @param {Array<{label, icon, action, danger?}>} menuItems
 *   action becomes a data-action value the caller listens for
 *   via delegated click handling — see wireActionMenus().
 */

/* ── Root-cause fix: store menu item HTML in a Map, not in the DOM ──
   Previous version rendered a hidden <div class="adm-action-menu"
   data-menu="rowId" style="display:none"> sibling INSIDE each <td>.
   Even with display:none, position:absolute elements still create
   paint boxes in the browser's stacking layer and intercept pointer
   events on elements beneath them. With the default page size of 20
   rows, the hidden menu divs from rows 1-N stacked up and covered the
   ⋮ buttons of rows N+1 onward — clicks registered on the invisible
   div, not the button. This is why rows 1-5 worked and everything
   after silently failed: the accumulated stack of hidden absolute-
   position divs grew tall enough to cover the later rows' buttons.

   Fix: _menuItemStore is a JS Map<rowId, itemsHtml>. renderActionCell()
   writes the HTML string into the Map instead of the DOM. wireActionMenus()
   reads it back when the ⋮ button is clicked and injects it into the
   fixed-position portal just-in-time. Zero hidden DOM nodes, zero
   position:absolute pollution, zero pointer-event interception.      */
const _menuItemStore = new Map();

export function renderActionCell(rowId, primaryBtn, menuItems) {
  if (!menuItems.length) {
    return `<div class="adm-row-actions">${primaryBtn}</div>`;
  }

  /* Build item markup and store it — NOT injected into the DOM. */
  const itemsHtml = menuItems.map((item) => `
    <button
      class="adm-action-menu-item${item.danger ? " adm-action-menu-item--danger" : ""}"
      data-action="${esc(item.action)}"
      data-row-id="${esc(rowId)}"
    >
      <i class="fa ${esc(item.icon)}" aria-hidden="true"></i>
      ${esc(item.label)}
    </button>`).join("");

  _menuItemStore.set(rowId, itemsHtml);

  /* Only the ⋮ toggle button goes into the DOM — no hidden menu div. */
  return `
    <div class="adm-row-actions">
      ${primaryBtn}
      <button
        class="adm-action-menu-btn"
        data-menu-toggle="${esc(rowId)}"
        aria-label="Altre azioni"
        aria-haspopup="true"
        aria-expanded="false"
      >
        <i class="fa fa-ellipsis-vertical" aria-hidden="true"></i>
      </button>
    </div>`;
}

/* ── Shared action menu portal ─────────────────────────────────
   One fixed-position element appended once to <body>.
   Repositioned via getBoundingClientRect() on every open so it
   is never clipped by overflow:hidden table containers.
─────────────────────────────────────────────────────────────── */

const _menuPortal = (() => {
  const el = document.createElement("div");
  el.className = "adm-action-menu";
  el.id        = "admActionMenuPortal";
  el.setAttribute("role", "menu");
  el.style.cssText = "position:fixed;display:none;z-index:9999;min-width:200px;";
  document.body.appendChild(el);
  return el;
})();

let _menuPortalRowId    = null;
let _menuPortalOnAction = null;

function _openMenuPortal(toggleBtn, rowId, itemsHtml, onAction) {
  _menuPortal.innerHTML     = itemsHtml;
  _menuPortalRowId          = rowId;
  _menuPortalOnAction       = onAction;

  /* Wire item clicks on the portal. stopPropagation prevents the
     document-level click handler from closing the menu on the same
     event tick as the item click. */
  _menuPortal.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      _closeMenuPortal();
      if (_menuPortalOnAction) {
        _menuPortalOnAction(btn.dataset.action, btn.dataset.rowId);
      }
    });
  });

  /* ── Measure-then-position ─────────────────────────────────────
     Strategy: always use `top` (never `bottom`) for position:fixed
     menus. `bottom` requires knowing the menu height before layout,
     which forces us to guess — the root cause of the previous bug.

     Instead:
       1. Make the portal invisible but laid-out (visibility:hidden)
          so the browser computes its real rendered height.
       2. Read that height via getBoundingClientRect().
       3. Decide: open below the button or above it?
       4. Clamp the final top value so the menu never escapes the
          viewport on any side, regardless of screen size or content.
       5. Make it visible.

     This is the same algorithm used by Floating UI / Popper.js.
  ─────────────────────────────────────────────────────────────── */

  // Step 1 — lay out invisibly so we can measure
  _menuPortal.style.visibility = "hidden";
  _menuPortal.style.display    = "block";
  _menuPortal.style.top        = "0";
  _menuPortal.style.bottom     = "";
  _menuPortal.style.left       = "";
  _menuPortal.style.right      = "";

  // Step 2 — measure actual rendered height and button position
  const menuRect = _menuPortal.getBoundingClientRect();
  const btnRect  = toggleBtn.getBoundingClientRect();
  const menuH    = menuRect.height;
  const menuW    = menuRect.width;
  const vw       = window.innerWidth;
  const vh       = window.innerHeight;
  const GAP      = 4; // px gap between button and menu

  // Step 3 — decide vertical direction
  const spaceBelow = vh - btnRect.bottom - GAP;
  const spaceAbove = btnRect.top - GAP;
  const openBelow  = spaceBelow >= menuH || spaceBelow >= spaceAbove;

  let top = openBelow
    ? btnRect.bottom + GAP
    : btnRect.top - menuH - GAP;

  // Step 4 — clamp so the menu never escapes the viewport
  const MARGIN = 8; // minimum distance from viewport edge
  top = Math.max(MARGIN, Math.min(top, vh - menuH - MARGIN));

  // Horizontal: align right edge of menu with right edge of button.
  // Clamp left edge so menu never overflows the left side.
  let right = vw - btnRect.right;
  const leftEdge = vw - right - menuW;
  if (leftEdge < MARGIN) {
    right = vw - menuW - MARGIN;
  }

  // Step 5 — apply computed position and reveal
  _menuPortal.style.top        = `${top}px`;
  _menuPortal.style.right      = `${right}px`;
  _menuPortal.style.visibility = "";

  toggleBtn.classList.add("open");
  toggleBtn.setAttribute("aria-expanded", "true");
}

function _closeMenuPortal() {
  _menuPortal.style.display = "none";
  _menuPortal.innerHTML     = "";
  _menuPortalRowId          = null;

  document.querySelectorAll(".adm-action-menu-btn.open").forEach((b) => {
    b.classList.remove("open");
    b.setAttribute("aria-expanded", "false");
  });
}

/* Close on outside click — the guard prevents closing the menu
   immediately on the same tick the ⋮ button opened it. */
document.addEventListener("click", (e) => {
  if (
    !_menuPortal.contains(e.target) &&
    !e.target.closest("[data-menu-toggle]")
  ) {
    _closeMenuPortal();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") _closeMenuPortal();
});

/* Close on scroll — stale position after the user scrolls. */
window.addEventListener("scroll", _closeMenuPortal, { passive: true });
document.querySelector(".adm-content")
  ?.addEventListener("scroll", _closeMenuPortal, { passive: true });

/**
 * Wire ⋮ toggle buttons rendered by renderActionCell() inside
 * `container`. Call once per table body after innerHTML is set.
 *
 * On each table refresh the tbody is replaced entirely, so the
 * old buttons are discarded. Re-calling wireActionMenus() on the
 * fresh tbody attaches exactly one listener per button — correct
 * by construction, no duplicate listeners possible.
 *
 * @param {Element} container  — the tbody holding the rows
 * @param {(action: string, rowId: string) => void} onAction
 */
export function wireActionMenus(container, onAction) {
  if (!container) return;

  container.querySelectorAll("[data-menu-toggle]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();

      const rowId    = btn.dataset.menuToggle;
      const itemsHtml = _menuItemStore.get(rowId);

      /* Guard: no item HTML registered for this rowId (shouldn't
         happen in normal operation, but defensive is correct here). */
      if (!itemsHtml) return;

      /* Toggle: clicking the same ⋮ button again closes the menu. */
      if (_menuPortalRowId === rowId && _menuPortal.style.display !== "none") {
        _closeMenuPortal();
        return;
      }

      _openMenuPortal(btn, rowId, itemsHtml, onAction);
    });
  });
}


/* ═══════════════════════════════════════════════════════════

   SECTION 2 — API CLIENT
   Single fetch wrapper: CSRF headers, JSON, 401 redirect
═══════════════════════════════════════════════════════════ */

export const Api = {
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

  async delete(path) {
    const res = await this._fetch(path, {
      method: "DELETE",
      headers: this._headers(true),
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

export function renderPagination(containerEl, infoEl, meta, onChange) {
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
export function buildPageWindow(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total]);
  for (let i = Math.max(2, current - 2); i <= Math.min(total - 1, current + 2); i++) {
    pages.add(i);
  }
  return [...pages].sort((a, b) => a - b);
}


/* ═══════════════════════════════════════════════════════════

   SECTION 6 — SORTABLE COLUMN HEADERS
   Makes th.adm-th-sortable toggle sortBy / sortOrder on click.
   Calls the provided onChange(sortBy, sortOrder) callback.
═══════════════════════════════════════════════════════════ */

export function initSortableHeaders(tableEl, state, onChange) {
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

   SECTION 12 — CONFIRM MODAL
   Generic confirmation dialog. Replaces browser alert().
═══════════════════════════════════════════════════════════ */

const admConfirmModal  = $("#admConfirmModal");
const admConfirmTitle  = $("#admConfirmTitle");
const admConfirmBody   = $("#admConfirmBody");
const admConfirmCancel = $("#admConfirmCancel");
const admConfirmOk     = $("#admConfirmOk");
let   _confirmCallback = null;

export function showConfirm(title, body, onConfirm) {
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