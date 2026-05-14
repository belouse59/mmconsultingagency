const customer = JSON.parse(localStorage.getItem("customer"));

if (!customer) window.location = "/loyalty/login.html";

QRCode.toCanvas(
  document.getElementById("qrcode"),
  customer.qrToken
);