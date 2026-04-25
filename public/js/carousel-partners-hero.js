let autoSlideInterval;

document.addEventListener("DOMContentLoaded", () => {
  loadCarousel();
});

async function loadCarousel() {
  const res = await fetch("/api/partners/images");
  const images = await res.json();

  const track = document.getElementById("carouselTrack");
  if (!track) return;

  track.innerHTML = "";

  const midpoint = Math.ceil(images.length / 2);
  const firstRow = images.slice(0, midpoint);
  const secondRow = images.slice(midpoint);

  function createSlide(rowImages) {
    const slide = document.createElement("div");
    slide.className = "carousel-slide";

    rowImages.forEach(src => {
      const img = document.createElement("img");
      img.src = src;
      slide.appendChild(img);
    });

    return slide;
  }

  track.appendChild(createSlide(firstRow));
  track.appendChild(createSlide(secondRow));

  initCarousel();
}

function initCarousel() {
  if (autoSlideInterval) clearInterval(autoSlideInterval);

  let currentSlide = 0;

  const slides = document.querySelectorAll(".carousel-slide");
  const track = document.querySelector(".carousel-track");
  const totalSlides = slides.length;

  if (!track || totalSlides === 0) return;

  function updateCarousel() {
    track.style.transform = `translateX(-${currentSlide * 100}%)`;
  }

  function nextSlide() {
    currentSlide = (currentSlide + 1) % totalSlides;
    updateCarousel();
  }

  function prevSlide() {
    currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
    updateCarousel();
  }

  // BUTTONS (FIXED SELECTORS)
  document.querySelector(".carousel-btn.left")
    .addEventListener("click", prevSlide);

  document.querySelector(".carousel-btn.right")
    .addEventListener("click", nextSlide);

  // AUTO SLIDE
  autoSlideInterval = setInterval(nextSlide, 5000);
}