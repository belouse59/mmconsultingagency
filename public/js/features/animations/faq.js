/**
 * public/js/components/faq.js
 *
 * Reusable FAQ accordion component.
 *
 * Replaces:
 *   - public/js/features/animations/faq.js  (homepage)
 *   - inline FAQ JS in loyalty-landing.html
 *
 * Usage:
 *   import { initFAQ } from "../../components/faq.js";
 *   initFAQ();                          // scopes to document
 *   initFAQ(myContainerElement);        // scopes to a subtree
 *
 * Required HTML structure:
 *
 *   <div class="faq-list" role="list">
 *     <div class="faq-item" role="listitem">
 *       <button class="faq-btn"
 *               aria-expanded="false"
 *               aria-controls="faq-UNIQUEID">
 *         Question text
 *         <span class="faq-chevron" aria-hidden="true">
 *           <i class="fa fa-chevron-down"></i>
 *         </span>
 *       </button>
 *       <div class="faq-answer" id="faq-UNIQUEID" hidden>
 *         <div class="faq-answer-inner">
 *           <p>Answer content…</p>
 *         </div>
 *       </div>
 *     </div>
 *     <!-- …more .faq-item elements -->
 *   </div>
 *
 * Design decisions:
 *   - Uses scrollHeight measurement (not a fixed max-height cap)
 *     so very long answers are never clipped.
 *   - hidden attribute is set/removed so the answer is correctly
 *     excluded from tab order and screen reader flow when closed.
 *   - One item open at a time (accordion behaviour).
 *   - aria-expanded kept in sync on every state change.
 *   - Keyboard: Enter/Space on the button (native behaviour via <button>).
 *   - Reduced motion: transitions suppressed via CSS (prefers-reduced-motion).
 *
 * @module faq
 */

"use strict";

/**
 * Initialise FAQ accordion behaviour inside `root`.
 *
 * @param {Element|Document} [root=document]
 */
export function initFAQ(root = document) {
  const buttons = root.querySelectorAll(".faq-btn");
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const item   = btn.closest(".faq-item");
      const isOpen = item.classList.contains("faq-item--open");

      // Close every other open item first
      root.querySelectorAll(".faq-item--open").forEach((openItem) => {
        if (openItem !== item) _close(openItem);
      });

      // Toggle clicked item
      isOpen ? _close(item) : _open(item);
    });
  });
}

/* ── Internal helpers ── */

function _open(item) {
  const btn    = item.querySelector(".faq-btn");
  const answer = item.querySelector(".faq-answer");

  item.classList.add("faq-item--open");
  btn?.setAttribute("aria-expanded", "true");

  if (answer) {
    answer.removeAttribute("hidden");
    // Measure the natural height so CSS transition animates correctly.
    // Setting to scrollHeight (then letting CSS handle the transition)
    // is more accurate than a fixed max-height cap.
    requestAnimationFrame(() => {
      answer.style.maxHeight = answer.scrollHeight + "px";
    });
  }
}

function _close(item) {
  const btn    = item.querySelector(".faq-btn");
  const answer = item.querySelector(".faq-answer");

  item.classList.remove("faq-item--open");
  btn?.setAttribute("aria-expanded", "false");

  if (answer) {
    answer.style.maxHeight = "0";
    // Restore hidden after transition ends so the answer
    // is removed from tab order and screen reader flow.
    answer.addEventListener(
      "transitionend",
      () => {
        if (!item.classList.contains("faq-item--open")) {
          answer.setAttribute("hidden", "");
        }
      },
      { once: true }
    );
  }
}