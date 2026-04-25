
//Team carrousel
let teamIndex = 0;
let teamData = [];
let teamInterval = null;

document.addEventListener("DOMContentLoaded", () => {
    loadTeam();
});

async function loadTeam() {
    try {
        const res = await fetch("/api/team");
        teamData = await res.json();

        renderTeam();
        initTeamCarousel();
    } catch (err) {
        console.error("Team load error:", err);
    }
}

function renderTeam() {
    const track = document.getElementById("teamTrack");
    if (!track) return;

    track.innerHTML = "";

    teamData.forEach((member, index) => {
        const slide = document.createElement("div");
        slide.className = "team-slide";
        if (index === 0) slide.classList.add("active");

        const badges = Array.isArray(member.badges)
            ? member.badges
            : [];

        slide.innerHTML = `
            <div class="team-card">

                <div class="team-image">
                    <img src="./assets/team/${member.imageId}" alt="${member.name}">
                </div>

                <div class="team-text">
                    <h3>${member.name}</h3>
                    <p>${member.description}</p>

                    <div class="team-badges">
                        ${badges.map(b => `✔ ${b}`).join("<br>")}
                    </div>
                </div>

            </div>
        `;

        track.appendChild(slide);
    });
}

function initTeamCarousel() {
    const track = document.getElementById("teamTrack");
    const slides = document.querySelectorAll(".team-slide");
    const total = slides.length;

    if (!track || total === 0) return;

    teamIndex = 0;

    function updateTeam() {
        track.style.transform = `translateX(-${teamIndex * 100}%)`;
        slides.forEach(slide => slide.classList.remove("active"));
        slides[teamIndex].classList.toggle("active");
    }

        function nextTeam() {
            teamIndex = (teamIndex + 1) % total;
            updateTeam();
        }

        function prevTeam() {
            teamIndex = (teamIndex - 1 + total) % total;
            updateTeam();
        }

        // prevent multiple intervals
        if (teamInterval) clearInterval(teamInterval);

        teamInterval = setInterval(nextTeam, 6000);

        // safe binding (avoid duplicates)
        const nextBtn = document.getElementById("teamNext");
        const prevBtn = document.getElementById("teamPrev");

        if (nextBtn) nextBtn.onclick = nextTeam;
        if (prevBtn) prevBtn.onclick = prevTeam;

        window.nextTeam = nextTeam;
        window.prevTeam = prevTeam;
    }

