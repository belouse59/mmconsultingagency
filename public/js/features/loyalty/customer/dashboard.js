const customer = JSON.parse(
  localStorage.getItem("loyaltyCustomer")
);

if (!customer) {
  window.location.href = "/loyalty/customer/login.html";
}

document.getElementById("customerIdentifier").textContent =
  customer.identifier;

const loadQr = async () => {
  const res = await fetch(
    `/api/loyalty/qr/${customer.qrToken}`
  );

  const data = await res.json();

  if (data.success) {
    document.getElementById("qrImage").src = data.qrImage;
  }
};

loadQr();

document
  .getElementById("logoutBtn")
  .addEventListener("click", () => {
    localStorage.removeItem("loyaltyCustomer");
    window.location.href = "/loyalty/customer/login.html";
  });