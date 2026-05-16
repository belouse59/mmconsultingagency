const customersBody = document.querySelector(
  "#customersTable tbody"
);

const redemptionsBody = document.querySelector(
  "#redemptionsTable tbody"
);

const offerForm = document.getElementById("offerForm");

/* LOAD CUSTOMERS */
const loadCustomers = async () => {
  const res = await fetch("/api/loyalty/admin/customers");
  const customers = await res.json();

  customersBody.innerHTML = "";

  customers.forEach((customer) => {
    customersBody.innerHTML += `
      <tr>
        <td>${customer.id}</td>
        <td>${customer.identifier}</td>
        <td>${customer.identifierType}</td>
        <td>${new Date(customer.createdAt).toLocaleDateString()}</td>
      </tr>
    `;
  });
};

/* LOAD REDEMPTIONS */
const loadRedemptions = async () => {
  const res = await fetch("/api/loyalty/admin/redemptions");
  const redemptions = await res.json();

  redemptionsBody.innerHTML = "";

  redemptions.forEach((item) => {
    redemptionsBody.innerHTML += `
      <tr>
        <td>${item.id}</td>
        <td>${item.customerId}</td>
        <td>${item.offerId}</td>
        <td>${item.partnerId}</td>
        <td>${item.date}</td>
      </tr>
    `;
  });
};

/* CREATE OFFER */
offerForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const body = {
    title: offerForm.title.value,
    description: offerForm.description.value,
  };

  const res = await fetch("/api/loyalty/admin/offers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (data.id) {
    alert("Offer created");
    offerForm.reset();
  }
});

loadCustomers();
loadRedemptions();