/* ─────────────────────────────────────────────────────────────
   PROVIDERS — populate simulator grid
───────────────────────────────────────────────────────────── */
import { $, $$ } from "../../core/dom.js";
export async function initProviders() {
  const grid = $("#providerGrid");
  if (!grid) return;

  try {
    const res = await fetch("/api/providers");
    if (!res.ok) return;
    const providers = await res.json();
    if (!providers?.length) return;

    grid.innerHTML = "";

    providers.forEach((p) => {
      const card = document.createElement("div");
      card.className = "sim-card provider-card";
      card.dataset.provider = p.key;
      card.setAttribute("role", "radio");
      card.setAttribute("aria-checked", "false");
      card.setAttribute("aria-label", p.name.toUpperCase());
      card.tabIndex = 0;

      card.innerHTML = `
        <img src="${p.image}" alt="${p.name}" width="40" height="40" loading="lazy">
        <span>${p.name}</span>`;

      card.addEventListener("click", () => {
        $$(".provider-card").forEach((c) => {
          c.classList.remove("active");
          c.setAttribute("aria-checked", "false");
        });
        card.classList.add("active");
        card.setAttribute("aria-checked", "true");

        /* Update simulator state via providerSelect */
        const sel = $(".provider-select");
        const inp = $(".provider-input");
        if (sel) sel.value = p.name.toUpperCase();
        if (inp) { inp.value = ""; inp.style.display = "none"; }

        /* Dispatch change so simulator state updates */
        sel?.dispatchEvent(new Event("change"));
      });

      /* Keyboard support */
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); card.click(); }
      });

      grid.appendChild(card);
    });
  } catch (err) {
    console.warn("Providers load failed:", err);
  }
}