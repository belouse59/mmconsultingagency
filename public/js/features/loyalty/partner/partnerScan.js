const partnerId = localStorage.getItem("partnerId");

if (!partnerId) {
  window.location.href = "/partner/login.html";
}

const resultEl = document.getElementById("result");

const scanner = new Html5Qrcode("reader");

const onScanSuccess = async (decodedText) => {
  scanner.stop();

  try {
    const res = await fetch("/api/loyalty/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: decodedText,
        offerId: "default-offer",
        partnerId,
      }),
    });

    const data = await res.json();

    if (data.success) {
      resultEl.textContent = "✅ Discount validated";
      resultEl.style.color = "green";
    } else {
      resultEl.textContent = `❌ ${data.message}`;
      resultEl.style.color = "red";
    }
  } catch (error) {
    resultEl.textContent = "Validation failed";
    resultEl.style.color = "red";
  }

  setTimeout(() => {
    window.location.reload();
  }, 2500);
};

scanner.start(
  { facingMode: "environment" },
  {
    fps: 10,
    qrbox: 250,
  },
  onScanSuccess
);