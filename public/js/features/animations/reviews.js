/**
 * features/animations/reviews.js
 * Reviews carousel with race-condition-free autoplay.
 *
 * Bug fixed from original:
 *   The original used setInterval which could fire at the same instant
 *   as a manual button click, causing the carousel to jump twice.
 *
 * Fix:
 *   - Use a single timer reference managed by _resetTimer().
 *   - Every manual navigation call clears the existing timer and
 *     schedules a fresh one — guaranteeing the autoplay interval
 *     always starts AFTER the last user interaction.
 *   - A boolean flag `_isTransitioning` prevents any navigation while
 *     a CSS transition is in progress, eliminating the double-jump.
 */

import { $, $$ } from "../../core/dom.js";

const AUTOPLAY_INTERVAL = 5500; // ms between automatic advances
const TRANSITION_DURATION = 520; // must match CSS transition duration on .reviews-track

export function initReviews() {
  const track = $(".reviews-track");
  if (!track) return;

  const cards = $$(".review-card", track);
  if (!cards.length) return;

  let idx             = 0;
  let _timer          = null;
  let _isTransitioning = false;

  /* ── Core navigation ── */
  function goTo(n) {
    if (_isTransitioning) return; // guard against double-jump

    _isTransitioning = true;
    idx = ((n % cards.length) + cards.length) % cards.length;
    track.style.transform = `translateX(-${idx * 100}%)`;

    /* Unblock navigation after CSS transition completes */
    setTimeout(() => { _isTransitioning = false; }, TRANSITION_DURATION);
  }

  /* ── Timer management ──
     Always clear before setting so there is only ever one timer running. */
  function _startTimer() {
    _timer = setTimeout(() => {
      goTo(idx + 1);
      _startTimer(); // schedule the next tick recursively
    }, AUTOPLAY_INTERVAL);
  }

  function _resetTimer() {
    clearTimeout(_timer);
    _startTimer();
  }

  /* ── Button handlers ── */
  function _navigate(direction) {
    goTo(idx + direction);
    _resetTimer(); // restart interval after manual interaction
  }

  /* Export to window for inline onclick handlers in HTML */
  window.nextReview = () => _navigate(1);
  window.prevReview = () => _navigate(-1);

  /* Attach to DOM buttons if they exist (avoids relying on inline onlick) */
  $(".carousel-btn--left",  track.closest(".reviews-carousel"))
    ?.addEventListener("click", () => _navigate(-1));
  $(".carousel-btn--right", track.closest(".reviews-carousel"))
    ?.addEventListener("click", () => _navigate(1));

  /* Pause autoplay on hover / focus — resume on leave */
  const container = track.closest(".reviews-carousel");
  container?.addEventListener("mouseenter", () => clearTimeout(_timer));
  container?.addEventListener("focusin",    () => clearTimeout(_timer));
  container?.addEventListener("mouseleave", _startTimer);
  container?.addEventListener("focusout",   _startTimer);

  /* Start autoplay */
  _startTimer();
}