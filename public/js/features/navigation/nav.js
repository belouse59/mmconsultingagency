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
}

/* ── CTA button ─────────────────────────────────────────────
   On mobile: becomes a tel: link so the OS phone dialler opens.
   On desktop: smooth scrolls to the contact section.           */
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

/* ── Hamburger ──────────────────────────────────────────────
   Toggles .open on the mobile menu and updates aria-expanded. */
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

/* ── Delegated smooth scroll ────────────────────────────────
   Single listener at document level handles every [data-target]
   element — nav links, mobile links, hero CTAs, highlight CTAs. */
function _initScrollLinks() {
  const burger     = $("#navBurger");
  const mobileMenu = $("#mobileMenu");

  document.addEventListener("click", (e) => {
    const link = e.target.closest("[data-target]");
    if (!link) return;

    const targetId = link.dataset.target;
    if (!targetId) return;

    /* Let tel: links behave normally on mobile */
    if (isMobile() && link.getAttribute("href")?.startsWith("tel:")) return;

    e.preventDefault();
    smoothScrollTo(targetId);

    /* Close mobile menu if open */
    if (mobileMenu?.classList.contains("open")) {
      mobileMenu.classList.remove("open");
      burger?.setAttribute("aria-expanded", "false");
    }
  });
}

/* ── Active nav link on scroll ──────────────────────────────
   Uses scroll listener + offsetTop comparison to mark the
   currently visible section in the nav.                       */
function _initActiveHighlight() {
  const sections   = $$("section[id]");
  const navLinks   = $$(".nav-link");
  const scrollHint = $("#scrollHint");

  const onScroll = () => {
    const scrollY = window.scrollY;

    /* Hide the bouncing chevron once user starts scrolling */
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
  onScroll(); // run once on load so active state is set immediately
}

/* ── Footer year ────────────────────────────────────────────
   Keeps the copyright year current without editing HTML.      */
function _initFooterYear() {
  const yearEl = $("#currentYear");
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

/* ── Legacy pipe-ID links ───────────────────────────────────
   Backward compat: some older HTML used id="Banner|contact"
   as a routing convention. This gracefully handles those.    */
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