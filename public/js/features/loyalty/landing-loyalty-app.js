import { initNav } from "../navigation/nav.js";
import { initReveal } from "../animations/reveal.js";
import { initWhatsApp } from "../whatsapp/whatsapp.js";
import { initNewsletter } from "../forms/newsletter.js";


/* ─────────────────────────────────────────────────────────────
   SCROLL RESTORATION — must run before DOMContentLoaded
───────────────────────────────────────────────────────────── */
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.scrollTo(0, 0);
window.addEventListener("load", () => {
  if (window.location.hash) history.replaceState(null, null, window.location.pathname);
  window.scrollTo(0, 0);
});

document.addEventListener("DOMContentLoaded", async () => {
  initNav();
  initReveal();
  initWhatsApp();
  initNewsletter();
});