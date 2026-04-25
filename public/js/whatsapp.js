
// WhatsApp
const input = document.getElementById("userMessage");
const whatsappFloat = document.querySelector(".whatsapp-float");
const whatsappCloseBtn = document.querySelector(".chat-close-btn");
input.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        if (event.shiftKey) {
            // Shift + Enter → new line
            return;
        } else {
            // Enter → send message
            event.preventDefault(); // prevent adding newline
            const message = input.value.trim();
            if (message !== "") {
                sendToWhatsApp();
            }
        }
    }
});
input.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = (this.scrollHeight) + "px";
});
let userInteracted = false;
setTimeout(() => {
    if (!userInteracted) {
        openChat(); // ✅ always opens (never toggles)
    }
}, 5000);

whatsappFloat.addEventListener("click", toggleChat);
whatsappCloseBtn.addEventListener("click", toggleChat);

function toggleChat() {
    console.log("Hey Whatsapp")
    userInteracted = true; // 🔥 user has interacted
    const chat = document.getElementById("whatsappChat");
    chat.classList.toggle("active");
}
/* Dedicated open function */
function openChat() {
    const chat = document.getElementById("whatsappChat");
    chat.classList.add("active");
}
function sendToWhatsApp() {
    const input = document.getElementById("userMessage");
    const message = input.value;

    const phoneNumber = "+34667218526"; // replace with your number
    const url = "https://wa.me/" + phoneNumber + "?text=" + encodeURIComponent(message);

    window.open(url, "_blank");

    input.value = ""; // clear after sending
    input.style.height = "auto"; // reset height
}
