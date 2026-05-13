/**
 * core/button.js
 * Manages the loading / done / reset state of submit buttons.
 * Works with the .btn, .btn-text, .btn-dots CSS classes defined in styles.css.
 *
 * Usage:
 *   import { setButtonLoading } from "../core/button.js";
 *
 *   setButtonLoading(btn, true);            // → shows spinner dots
 *   setButtonLoading(btn, false, "Inviato"); // → restores with new label
 *   setButtonLoading(btn, false);           // → restores, keeps existing label
 */

/**
 * @param {HTMLElement|null} btn   - The button element to update.
 * @param {boolean}          loading - true = enter loading state.
 * @param {string|null}      label   - Optional new label text for the .btn-text span.
 */
export function setButtonLoading(btn, loading, label = null) {
  if (!btn) return;

  if (loading) {
    /* Lock the button width so it doesn't shrink when text hides */
    if (!btn.dataset.widthLocked) {
      btn.style.width         = btn.offsetWidth + "px";
      btn.dataset.widthLocked = "1";
    }
    btn.classList.add("loading");
    btn.disabled = true;
  } else {
    btn.classList.remove("loading");
    btn.disabled = false;

    if (label !== null) {
      const textEl = btn.querySelector(".btn-text");
      if (textEl) textEl.textContent = label;
    }
  }
}