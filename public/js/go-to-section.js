
let sectionId;

function goToSection(e) {
    sectionId = e.currentTarget.id.split("|")[1];
    const target = document.getElementById(sectionId);
    if (!target || (sectionId === "contact" && isMobile)) return;
    e.preventDefault();

    // 🔥 Get banner height dynamically
    const banner = document.querySelector('.banner');
    const offset = banner ? banner.offsetHeight + 35 : 20; // 20px breathing space

    const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;
    const startPosition = window.pageYOffset;
    const distance = targetPosition - startPosition;

    let startTime = null;
    const duration = 1200; // animation duration in ms

    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const run = easeInOutQuad(timeElapsed, startPosition, distance, duration);
        window.scrollTo(0, run);

        if (timeElapsed < duration) requestAnimationFrame(animation);
    }

    function easeInOutQuad(t, b, c, d) {
        t /= d / 2;
        if (t < 1) return c / 2 * t * t + b;
        t--;
        return -c / 2 * (t * (t - 2) - 1) + b;
    }

    requestAnimationFrame(animation);
}

// Attach to all elements with "|" in their id
document.querySelectorAll('[id*="|"]').forEach(el => {
    el.addEventListener("click", goToSection);
});
