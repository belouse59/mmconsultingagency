async function loadProviders() {
  const res = await fetch("/api/providers");
  const providers = await res.json();
  const grid = document.getElementById("providerGrid");
  if (!grid) return;

  grid.innerHTML = "";

  providers.forEach(p => {
    const card = document.createElement("div");
    card.className = "simulator-card provider-card";
    card.dataset.provider = p.key;

    card.innerHTML = `
      <img src="${p.image}" alt="${p.name}">
      <span>${p.name}</span>
    `;

    grid.appendChild(card);
    card.addEventListener("click", () => {
      document.querySelectorAll(".simulator-card.provider-card")
      .forEach(c => c.classList.remove("active"));
      card.classList.add("active");

      selectedProvider = card.dataset.provider;

      // Reset others
      providerSelect.value = "";
      providerInput.value = "";
      providerInput.style.display = "none";

      updateButtons();
    });
  });
}

document.addEventListener("DOMContentLoaded", loadProviders);