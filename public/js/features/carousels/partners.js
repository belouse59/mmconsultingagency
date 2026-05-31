// /**
//  * features/carousels/partners.js
//  * Fetches partner logos from the API and builds the marquee.
//  *
//  * Primary behaviour: infinite CSS marquee (duplicates the image set so
//  * the animation loops seamlessly).
//  *
//  * Fallback behaviour: if the legacy carousel DOM is detected instead of
//  * the marquee track, builds paginated slides and delegates to legacyCarousel.
//  */

// import { getJSON } from "../../core/api.js";
// import { initLegacyCarousel } from "./legacyCarousel.js";

// export async function initPartners() {
//   const marqueeTrack  = document.getElementById("marqueeTrack");
//   const legacyTrack   = document.getElementById("carouselTrack");
//   const track         = marqueeTrack || legacyTrack;

//   if (!track) return;

//   const images = await getJSON("/api/partners/images");
//   if (!images?.length) return;

//   /* ── Marquee (primary) ── */
//   if (track.id === "marqueeTrack") {
//     /* Two copies so the CSS animation loops without a visible gap */
//     [..._buildImgs(images), ..._buildImgs(images), ..._buildImgs(images)].forEach((img) =>
//       track.appendChild(img)
//     );
//     return;
//   }

//   /* ── Legacy paginated carousel (fallback) ── */
//   track.innerHTML = "";
//   const mid  = Math.ceil(images.length / 2);
//   const rows = [images.slice(0, mid), images.slice(mid)];

//   rows.forEach((rowImgs) => {
//     const slide = document.createElement("div");
//     slide.className = "carousel-slide";

//     rowImgs.forEach((src) => {
//       const img = document.createElement("img");
//       img.src     = src;
//       img.alt     = "Logo fornitore partner M&M Consulting";
//       img.loading = "lazy";
//       slide.appendChild(img);
//     });

//     track.appendChild(slide);
//   });

//   initLegacyCarousel(track, ".carousel-btn.left", ".carousel-btn.right", 5000);
// }

// /* ── Helpers ── */
// function _buildImgs(srcs) {
//   return srcs.map((src) => {
//     const img   = document.createElement("img");
//     img.src     = src;
//     img.alt     = "Logo fornitore partner M&M Consulting";
//     img.width   = 110;
//     img.height  = 40;
//     img.loading = "lazy";
//     return img;
//   });
// }