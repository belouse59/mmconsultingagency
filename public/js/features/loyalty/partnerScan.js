const scanner = new Html5Qrcode("reader");

scanner.start(
  { facingMode: "environment" },
  { fps: 10, qrbox: 250 },
  async (decodedText) => {
    await fetch("/api/loyalty/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: decodedText,
        offerId: "default-offer",
        partnerId: "default-partner",
      }),
    });

    alert("Validation complete");
  }
);