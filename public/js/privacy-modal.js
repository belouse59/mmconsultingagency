
const privacyLink = document.getElementById("privacyLink");
const modal = document.getElementById("privacyModal");
const closeBtn = document.getElementById("closePrivacyModal");

// open modal
privacyLink.addEventListener("click", function (e) {
    e.preventDefault();
    modal.classList.add("active");
});

// close modal (button)
closeBtn.addEventListener("click", function () {
    modal.classList.remove("active");
});

// close modal (click outside)
modal.addEventListener("click", function (e) {
    if (e.target === modal) {
        modal.classList.remove("active");
    }
});