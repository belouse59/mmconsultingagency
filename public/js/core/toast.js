/**
 * core/toast.js
 * Accessible, self-removing toast notification.
 * Creates a DOM element, animates it in, auto-removes after duration.
 *
 * Usage:
 *   import { showToast } from "../core/toast.js";
 *   showToast("Richiesta inviata!", "success");
 *   showToast("Errore di rete.", "error");
 */

/**
 * @param {string} html      - Message content (HTML allowed for bold/italic).
 * @param {"success"|"error"} type - Visual style variant.
 * @param {number} duration  - Visible duration in ms (default 4500).
 */
export function showToast(html, type = "success", duration = 4500) {
  const toast = document.createElement("div");
  toast.className  = `toast ${type}`;
  toast.innerHTML  = html;
  toast.setAttribute("role", "status");       // polite live region
  toast.setAttribute("aria-live", "polite");
  document.body.appendChild(toast);

  /* Double rAF ensures the element is in the DOM before the transition fires */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add("visible"));
  });

  setTimeout(() => {
    toast.classList.remove("visible");
    /* Wait for CSS transition to finish before removing the node */
    setTimeout(() => toast.remove(), 500);
  }, duration);
}