/**
 * features/animations/faq.js
 * Accessible accordion for the FAQ section.
 *
 * Behaviour:
 *   - Clicking an open item closes it.
 *   - Clicking a closed item opens it and closes any other open item.
 *   - aria-expanded is kept in sync for screen readers.
 *   - The answer uses max-height animation (CSS transition) so height
 *     adjusts to content without JS measurement on every resize.
 */

import { $$ } from "../../core/dom.js";

export function initFAQ() {
  const questions = $$(".faq-question");
  if (!questions.length) return;

  questions.forEach((btn) => {
    btn.addEventListener("click", () => {
      const item   = btn.closest(".faq-item");
      const isOpen = item.classList.contains("active");
      const answer = item.querySelector(".faq-answer");

      /* Close every other open item first */
      $$(".faq-item.active").forEach((openItem) => {
        if (openItem === item) return;
        _closeItem(openItem);
      });

      /* Toggle the clicked item */
      isOpen ? _closeItem(item) : _openItem(item);
    });
  });
}

function _openItem(item) {
  const btn    = item.querySelector(".faq-question");
  const answer = item.querySelector(".faq-answer");

  item.classList.add("active");
  btn?.setAttribute("aria-expanded", "true");

  if (answer) {
    answer.removeAttribute("hidden");
    /* Set exact scrollHeight so CSS transition animates to the right height */
    answer.style.maxHeight = answer.scrollHeight + "px";
  }
}

function _closeItem(item) {
  const btn    = item.querySelector(".faq-question");
  const answer = item.querySelector(".faq-answer");

  item.classList.remove("active");
  btn?.setAttribute("aria-expanded", "false");

  if (answer) {
    answer.style.maxHeight = "0";
    /* Add hidden after transition ends so it is skipped by tab/screen readers */
    setTimeout(() => answer.setAttribute("hidden", ""), 400);
  }
}