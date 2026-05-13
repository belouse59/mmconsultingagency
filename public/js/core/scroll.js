


/**
 * core/scroll.js
 * Handles two responsibilities:
 *   1. Scroll restoration — must execute before DOMContentLoaded so it
 *      runs at module parse time when imported.
 *   2. smoothScrollTo() — exported for use by navigation and simulator.
 */

/* ── Scroll restoration ──────────────────────────────────────
   Runs immediately at import time (top-level module code).
   Prevents the browser from jumping to a hash or previous scroll
   position on page load. */
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}
window.scrollTo(0, 0);

window.addEventListener("load", () => {
  if (window.location.hash) {
    history.replaceState(null, null, window.location.pathname);
  }
  window.scrollTo(0, 0);
});

/* ── Smooth scroll ───────────────────────────────────────────
   Custom eased scroll that accounts for the fixed nav height.
   Uses requestAnimationFrame for a 60fps animation — no library needed.

   @param {string} targetId  - The `id` attribute of the target element.
*/
export function smoothScrollTo(targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;

  const nav    = document.querySelector(".site-header") || document.querySelector(".banner");
  const offset = nav ? nav.offsetHeight + 20 : 20;
  const top    = el.getBoundingClientRect().top + window.pageYOffset - offset;
  const start  = window.pageYOffset;
  const dist   = top - start;
  let startTime = null;

  /* Ease-in-out quad */
  function step(now) {
    if (!startTime) startTime = now;
    const t      = Math.min((now - startTime) / 1100, 1);
    const eased  = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    window.scrollTo(0, start + dist * eased);
    if (t < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}