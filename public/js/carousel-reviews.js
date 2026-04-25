let reviewIndex = 0;
const reviewTrack = document.querySelector('.reviews-track');
const reviewSlides = document.querySelectorAll('.review-card');

function updateReview() {
    reviewTrack.style.transform = `translateX(-${reviewIndex * 100}%)`;
}

function nextReview() {
    reviewIndex = (reviewIndex + 1) % reviewSlides.length;
    updateReview();
}

function prevReview() {
    reviewIndex = (reviewIndex - 1 + reviewSlides.length) % reviewSlides.length;
    updateReview();
}

// Auto slide
setInterval(nextReview, 5000);