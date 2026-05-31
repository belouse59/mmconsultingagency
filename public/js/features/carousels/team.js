/**
 * features/carousels/team.js
 * Fetches team data from the API, builds team member slides,
 * and manages the carousel with race-condition-free autoplay.
 *
 * Same timer-reset pattern as reviews.js — manual navigation
 * always clears and restarts the autoplay timer so the interval
 * begins AFTER the last user interaction, never in the middle of it.
 */

import { $, $$ } from "../../core/dom.js";
//import { getJSON } from "../../core/api.js";

const AUTOPLAY_INTERVAL = 6500;

// export async function initTeam() {
//   const track = $("#teamTrack");
//   if (!track) return;

//   const team = await getJSON("/api/team");
//   if (!team?.length) return;

//   /* ── Build slides ── */
//   track.innerHTML = "";

//   team.forEach((member, i) => {
//     const slide = document.createElement("div");
//     slide.className = "team-slide" + (i === 0 ? " active" : "");

//     const badges = Array.isArray(member.badges)
//       ? member.badges.map((b) => `<span class="team-badge">${b}</span>`).join("")
//       : "";

//     slide.innerHTML = `
//       <div class="team-card">
//         <div class="team-image">
//           <img
//             src="./assets/team/${member.imageId}"
//             alt="Foto di ${member.name}, ${member.role} – M&amp;M Consulting"
//             loading="lazy"
//             width="160"
//             height="190">
//         </div>
//         <div class="team-text">
//           <h3>${member.name}</h3>
//           <span class="team-role">${member.role}</span>
//           <p>${member.description}</p>
//           <div class="team-badges">${badges}</div>
//         </div>
//       </div>`;

//     track.appendChild(slide);
//   });
export function logicTeamCarousel(){

  /* ── Carousel logic ── */
  const track = $("#teamTrack");
  const slides = $$(".team-slide", track.parentElement);
  const total  = slides.length;
  let idx      = 0;
  let _timer   = null;

  function goTo(n) {
    slides[idx].classList.remove("active");
    idx = ((n % total) + total) % total;
    slides[idx].classList.add("active");
    track.style.transform = `translateX(-${idx * 100}%)`;
  }

  function _startTimer() {
    _timer = setTimeout(() => {
      goTo(idx + 1);
      _startTimer();
    }, AUTOPLAY_INTERVAL);
  }

  function _navigate(direction) {
    clearTimeout(_timer);
    goTo(idx + direction);
    _startTimer();
  }

  /* DOM buttons */
  $("#teamNext")?.addEventListener("click", () => _navigate(1));
  $("#teamPrev")?.addEventListener("click", () => _navigate(-1));

  /* Expose for legacy onclick in HTML */
  window.nextTeam = () => _navigate(1);
  window.prevTeam = () => _navigate(-1);

  _startTimer();
}
//}