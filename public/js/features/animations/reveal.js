/**
 * features/animations/reveal.js
 * Scroll-reveal animation using IntersectionObserver.
 * Elements with class .reveal start invisible (defined in CSS) and
 * receive .visible when they enter the viewport.
 *
 * The observer is created once and watches all .reveal elements,
 * then disconnects individual entries after they have been revealed
 * (no point observing elements that are already visible).
 */

import { $, $$ } from "../../core/dom.js";

export function initReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add("visible");

        /* Side-effect: also reveal the stats section when the
           simulator section enters view — they share visual space. */
        if (entry.target.classList.contains("simulator-section")) {
          $(".stats")?.classList.add("visible");
        }

        /* Stop observing once revealed — it only needs to happen once */
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.15 }
  );

  $$(".reveal").forEach((el) => observer.observe(el));
  // WhatsApp floating button mobile behavior
  initWhatsAppFloat();
}

function initWhatsAppFloat() {
  if (window.innerWidth > 1400) return;

  const waButton = $(".wa-float");
  const footer = $("#footer") || $("#blog-link");
  console.log(waButton, footer)

  if (!waButton || !footer) return;

  const floatObserver = new IntersectionObserver(
    ([entry]) => {
      console.log("I will toggle is-raised");
      waButton.classList.toggle("is-raised", entry.isIntersecting);
    },
    {
      threshold: 0.1
    }
  );

  floatObserver.observe(footer);
}