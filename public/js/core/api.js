/**
 * core/api.js
 * Centralised fetch wrapper for all backend API calls.
 * Every call returns a consistent { success, message } shape —
 * callers never need to inspect HTTP status codes themselves.
 *
 * Usage:
 *   import { postForm, getJSON } from "../core/api.js";
 *
 *   const result = await postForm({ formType: "contact", ... });
 *   if (result.success) { ... }
 *
 *   const providers = await getJSON("/api/providers");
 */

/** Base URL — empty string means same origin. Override in .env if needed. */
const API_BASE = "";

/**
 * POST JSON payload to the form submission endpoint.
 * @param {Object} payload
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function postForm(payload, endpoint="/api/form/submit") {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { success: false, message: `Errore ${res.status}` };
    const data = await res.json();
    return { success: data.success, message: data.message || "" };
  } catch {
    return { success: false, message: "Errore di connessione. Riprova." };
  }
}

/**
 * GET JSON from any API endpoint.
 * Returns null on any error so callers can guard with a simple null check.
 * @param {string} url
 * @returns {Promise<any|null>}
 */
export async function getJSON(url) {
  try {
    const res = await fetch(`${API_BASE}${url}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}