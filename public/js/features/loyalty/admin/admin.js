const $ = (s) => document.querySelector(s);

const customersTable = $("#customersTableBody");
const redemptionsTable = $("#redemptionsTableBody");
const offerForm = $("#offerForm");
const offerMessage = $("#offerMessage");

/* -------------------------
   CUSTOMERS
------------------------- */
async function loadCustomers() {
  try {
    const res = await fetch("/api/loyalty/admin/customers");
    const data = await res.json();

    if (!data.success) return;

    $("#totalCustomers").textContent = data.customers.length;

    customersTable.innerHTML = data.customers
      .map(
        (customer) => `
          <tr>
            <td>${customer.identifier}</td>
            <td>${customer.active ? "Active" : "Inactive"}</td>
          </tr>
        `
      )
      .join("");

  } catch (err) {
    console.error(err);
  }
}

/* -------------------------
   REDEMPTIONS
------------------------- */
async function loadRedemptions() {
  try {
    const res = await fetch("/api/loyalty/admin/redemptions");
    const data = await res.json();

    if (!data.success) return;

    $("#totalRedemptions").textContent =
      data.redemptions.length;

    redemptionsTable.innerHTML = data.redemptions
      .map(
        (item) => `
          <tr>
            <td>${item.customerId}</td>
            <td>${item.partnerId}</td>
            <td>${item.date || "-"}</td>
          </tr>
        `
      )
      .join("");

  } catch (err) {
    console.error(err);
  }
}

/* -------------------------
   CREATE OFFER
------------------------- */
async function createOffer(e) {
  e.preventDefault();

  try {
    const payload = {
      title: $("#offerTitle").value.trim(),
      partner: $("#offerPartner").value.trim()
    };

    const res = await fetch("/api/loyalty/admin/offers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!data.success) {
      throw new Error(data.message || "Offer creation failed");
    }

    offerMessage.textContent = "Offer created successfully";
    offerMessage.className = "loyalty-feedback success";

    offerForm.reset();

  } catch (err) {
    offerMessage.textContent = err.message;
    offerMessage.className = "loyalty-feedback error";
  }
}

offerForm?.addEventListener("submit", createOffer);

/* -------------------------
   INIT
------------------------- */
loadCustomers();
loadRedemptions();