
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            //console.log(entry.target.classList.value)
            if (entry.target.classList.contains("simulator-section")) {
                document.querySelector('.results-section').classList.add('visible')
            }
            entry.target.classList.add('visible');
        } else {
            //entry.target.classList.remove('visible');
        }
    });
}, {
    threshold: 0.2,
    //  rootMargin: '0px 0px -0px 0px' // shift the trigger slightly down
});

// Observe ALL animated sections
document.querySelectorAll('.business-section, .why-us-section, .contact-form, .approach-section, .team-section, .faq-section, .simulator-section') //.results-section,
    .forEach(section => observer.observe(section));