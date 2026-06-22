/**
 * features/navigation/nav.js
 * Handles all navigation behaviour:
 *   - Mobile hamburger toggle
 *   - CTA button: phone call on mobile, smooth scroll on desktop
 *   - Delegated smooth scroll for all [data-target] links
 *   - Active nav link highlighting on scroll
 *   - Scroll hint visibility
 *   - Footer copyright year
 *   - Backward compatibility for legacy pipe-ID selectors
 *   - Session-aware "Accedi" link (NEW)
 */

import { $, $$ } from "../../core/dom.js";
import { smoothScrollTo } from "../../core/scroll.js";

const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export function initNav() {
  _initCTA();
  _initHamburger();
  _initScrollLinks();
  _initActiveHighlight();
  _initFooterYear();
  _initLegacyPipeLinks();
  _initAuthLink();
}

/* ── CTA button (unchanged) ── */
function _initCTA() {
  const ctaBtn = $("#navCtaBtn");
  if (!ctaBtn) return;

  if (isMobile()) {
    ctaBtn.setAttribute("href", "tel:+390909412150");
    ctaBtn.removeAttribute("data-target");
  } else {
    const textEl = ctaBtn.querySelector(".nav-cta-text");
    if (textEl) textEl.textContent = "Contattaci";
  }
}

/* ── Hamburger (unchanged) ── */
function _initHamburger() {
  const burger     = $("#navBurger");
  const mobileMenu = $("#mobileMenu");
  if (!burger || !mobileMenu) return;

  burger.addEventListener("click", () => {
    const open = mobileMenu.classList.toggle("open");
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Chiudi menu" : "Apri menu");
  });
}

/* ── Delegated smooth scroll (unchanged) ── */
function _initScrollLinks() {
  const burger     = $("#navBurger");
  const mobileMenu = $("#mobileMenu");

  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-target]");
    if (!link) return;

    const targetId = link.dataset.target;
    if (!targetId) return;

    if (isMobile() && link.getAttribute("href")?.startsWith("tel:")) return;

    e.preventDefault();
    smoothScrollTo(targetId);

    if (mobileMenu?.classList.contains("open")) {
      mobileMenu.classList.remove("open");
      burger?.setAttribute("aria-expanded", "false");
    }
  });
}

/* ── Active nav link on scroll (unchanged) ── */
function _initActiveHighlight() {
  const sections   = $$("section[id]");
  const navLinks   = $$(".nav-link");
  const scrollHint = $("#scrollHint");

  const onScroll = () => {
    const scrollY = window.scrollY;

    if (scrollHint) scrollHint.classList.toggle("hidden", scrollY > 120);

    let current = "";
    sections.forEach((s) => {
      if (scrollY >= s.offsetTop - 140) current = s.id;
    });

    navLinks.forEach((a) => {
      a.classList.toggle("active", a.dataset.target === current);
    });
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

/* ── Footer year (unchanged) ── */
function _initFooterYear() {
  const yearEl = $("#currentYear");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

/* ── Legacy pipe-ID links (unchanged) ── */
function _initLegacyPipeLinks() {
  $$("[id*='|']").forEach((el) => {
    el.addEventListener("click", (e) => {
      const id = el.id.split("|")[1];
      if (!id) return;
      if (isMobile() && id === "contact") return;
      e.preventDefault();
      smoothScrollTo(id);
    });
  });
}

/* ── Session-aware "Accedi" link ──────────────────────────────
   NEW. Checks GET /api/loyalty/session once on load and, if a
   session exists, swaps every [data-auth-link] element's label
   and href to the role-appropriate (label, dashboardUrl) pair
   returned by the backend — no role→URL mapping table here,
   the backend (sessionLoyaltyController.js) is the single
   source of truth for that.

   Targets every element with [data-auth-link] so the same logic
   covers both the desktop nav-link and the mobile-menu entry
   without two separate code paths.

   Fails silently (network error, non-200, etc.) — an anonymous
   "Accedi" link is always a safe default to leave in place if
   the session check can't complete for any reason.
─────────────────────────────────────────────────────────────── */
async function _initAuthLink() {
  const links = $$("[data-auth-link]");
  if (!links.length) return;

  try {
    const res = await fetch("/api/loyalty/session", {
      credentials: "same-origin",
    });
    if (!res.ok) return;

    const data = await res.json();
    if (!data.authenticated) return;

    links.forEach((link) => {
      link.href = data.dashboardUrl;
      link.removeAttribute("data-target"); // ensure smooth-scroll delegation doesn't intercept it

      const textEl = link.querySelector("[data-auth-link-text]");
      if (textEl) {
        textEl.textContent = data.label;
      } else {
        link.textContent = data.label;
      }
    });
  } catch {
    /* Anonymous "Accedi" stays as the safe default. */
  }
}