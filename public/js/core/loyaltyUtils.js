export function setLoading(btn, on) {
    if (!btn) return;

    btn.disabled = on;
    btn.classList.toggle("loading", on);
}


/* ── Helpers ── */
export function showError(msg, errorText, errorBox) {
  errorText.textContent = msg;
  errorBox.classList.add("visible");
  errorBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
 
export function hideError(errorBox) {
  errorBox.classList.remove("visible");
}

export function showSuccess(successBox, errorBox) {
  successBox.classList.add("visible");
  errorBox.classList.remove("visible");
}
 
export function safeRedirect(fallback) {
  const p    = new URLSearchParams(window.location.search).get("next");
  const dest = p && p.startsWith("/") && !p.startsWith("//") ? p : fallback;
  window.location.replace(dest);
}
