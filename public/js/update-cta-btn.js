
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const cta = document.getElementById("banner|contact");

if (isMobile) {
    console.log("Mobile")
    cta.setAttribute("href", "tel:+34123456789");
} else {
    console.log("Desktop")
    cta.innerText = "Contattaci";
}
