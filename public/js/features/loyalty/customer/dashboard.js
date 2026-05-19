const $ = (s) => document.querySelector(s);

//const customer = JSON.parse(localStorage.getItem("loyaltyCustomer"));

// if (!customer) {
//   window.location.href = "/loyalty/customer/login.html";
// }

const $qr = $("#qrImage");
const $logout = $("#logoutBtn");
const $skeleton = $("#qrSkeleton");
const $qrContainer = $("#qrContainer");
const $status = $("#customerStatus");

/* -------------------------
   INIT CUSTOMER STATUS
------------------------- */
function initCustomerStatus() {
  if (!$status) return;

  if (customer.active) {
    $status.textContent = "Active Member";
    $status.classList.add("active");
  } else {
    $status.textContent = "Inactive Account";
    $status.classList.add("inactive");
  }
}

/* -------------------------
   LOAD QR WITH LUXURY REVEAL
------------------------- */
async function loadQR() {
  try {
    const res = await fetch(`/api/loyalty/qr/${customer.qrToken}`);
    const data = await res.json();

    if (!data?.success || !data.qrImage) {
      throw new Error("Invalid QR response");
    }

    $qr.src = data.qrImage;

    $qr.onload = () => {
      if ($skeleton) {
        $skeleton.style.opacity = "0";
        setTimeout(() => $skeleton.remove(), 300);
      }

      $qrContainer?.classList.add("revealed");
      $qr.classList.add("is-loaded");
    };

  } catch (err) {
    console.error(err);
  }
}

/* -------------------------
   LOGOUT
------------------------- */
$logout?.addEventListener("click", () => {
  window.location.href = "/loyalty/customer/login.html";
});

/* -------------------------
   INIT
------------------------- */
initCustomerStatus();
loadQR();