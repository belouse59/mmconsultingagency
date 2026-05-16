const form = document.getElementById("partnerLoginForm");

form.addEventListener("submit", (e) => {
    e.preventDefault();

    const partnerId = form.partnerId.value.trim();

    localStorage.setItem("partnerId", partnerId);
    window.location.href = "/partner/scan.html";
});
