import { initNav } from "./features/navigation/nav.js";

import { initReveal } from "./features/animations/reveal.js";
import { initFAQ } from "./features/animations/faq.js";
import { initReviews } from "./features/animations/reviews.js";

//import { initPartners } from "./features/carousels/partners.js";
//import { initTeam } from "./features/carousels/team.js";
import { logicTeamCarousel } from "./features/carousels/team.js"; 

import { initWhatsApp } from "./features/whatsapp/whatsapp.js";

import { initContactForm } from "./features/forms/contactForm.js";
import { initNewsletter } from "./features/forms/newsletter.js";

import { initProviders } from "./features/simulator/providers.js";
import { initSimulator } from "./features/simulator/simulator.js";


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
  initFAQ();
  initReviews();

  initWhatsApp();

  initContactForm();
  initNewsletter();

  logicTeamCarousel();
  //await initPartners();
  //await initTeam();

  initProviders();
  initSimulator();
});