/**
 * core/dom.js
 * Lightweight DOM query helpers used across all feature modules.
 * Import these instead of writing querySelector every time.
 */

/**
 * Select a single element. Returns null if not found.
 * @param {string} selector
 * @param {Document|Element} ctx
 * @returns {Element|null}
 */
export const $ = (selector, ctx = document) => ctx.querySelector(selector);

/**
 * Select all matching elements as a plain Array.
 * @param {string} selector
 * @param {Document|Element} ctx
 * @returns {Element[]}
 */
export const $$ = (selector, ctx = document) => [...ctx.querySelectorAll(selector)];