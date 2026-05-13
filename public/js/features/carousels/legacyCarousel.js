/**
 * features/carousels/legacyCarousel.js
 * Simple paginated carousel for cases where the CSS marquee cannot be used
 * (e.g. the server returned too few partner images for an infinite loop).
 *
 * Used only as a fallback inside partners.js.
 * Not used by team.js (which has its own richer carousel logic).
 *
 * @param {Element} track      - The scrolling track element.
 * @param {string}  leftSel    - CSS selector for the "previous" button.
 * @param {string}  rightSel   - CSS selector for the "next" button.
 * @param {number}  interval   - Autoplay interval in ms.
 */
export function initLegacyCarousel(track, leftSel, rightSel, interval) {
  const slides = track.querySelectorAll(".carousel-slide");
  if (!slides.length) return;

  let idx   = 0;
  let timer = null;

  function goTo(n) {
    idx = ((n % slides.length) + slides.length) % slides.length;
    track.style.transform = `translateX(-${idx * 100}%)`;
  }

  function resetTimer() {
    clearInterval(timer);
    timer = setInterval(() => goTo(idx + 1), interval);
  }

  document.querySelector(leftSel)?.addEventListener("click", () => {
    goTo(idx - 1);
    resetTimer();
  });

  document.querySelector(rightSel)?.addEventListener("click", () => {
    goTo(idx + 1);
    resetTimer();
  });

  timer = setInterval(() => goTo(idx + 1), interval);
}