
const phoneToggle = document.getElementById("phoneToggle");
const contactTimeRow = document.getElementById("contactTimeRow");
const phoneInput = document.getElementById("phoneInput");
const form = document.getElementById('contactForm');
const newsletterForm = document.getElementById('newsletterForm');
const buttonNewsletterForm = document.getElementById('newsletter-btn');
const buttonContactForm = document.getElementById('contact-btn');
const consentBlock = document.querySelector(".consent-block");
const consent = document.getElementById('consent-checkbox');
const error = document.getElementById("consentError");

consent.addEventListener("change", function () {
    if (consent.checked) {
        consentBlock.classList.remove("error");

        // 👇 ALSO REMOVE ERROR MESSAGE
        error.classList.remove("visible");
    }
});

phoneToggle.addEventListener("change", () => {
    if (phoneToggle.checked) {
        contactTimeRow.style.display = "flex";
        phoneInput.required = true;
    } else {
        contactTimeRow.style.display = "none";
        phoneInput.required = false;
    }
});

function showToaster(message, type = "success") {
    // create toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = message

    document.body.appendChild(toast);

    // force reflow to enable transition
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 100);

    // hide and remove
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.remove();
        }, 500); // fade-out duration
    }, 4000);
}

form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!consent.checked) {
        e.preventDefault();

        consentBlock.classList.add("error");

        // 👇 THIS IS WHAT YOU FORGOT
        error.classList.add("visible");

        consentBlock.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
    }
    const firstname = this.firstname.value;
    const lastname = this.lastname.value;
    const email = this.email.value;
    const phone = this.phone.value;
    const energyType = this.energyType.value;
    const contactTime = this.contactTime.value
    const messageForm = this.message.value
    const ourPhone = "+39 090 941 2150"
    const formType = "contact"
    console.log(email, phone, contactTime)
    if (!this.email.checkValidity()) {
        showToaster("Inserisci un'email valida.", "error");
        return;
    }
    if (phoneToggle.checked && !this.phone.checkValidity()) {
        showToaster("Inserisci un numero valido.", "error");
        return;
    }
    if (phoneToggle.checked && !contactTime) {
        showToaster("Seleziona l’orario di contatto.", "error");
        return;
    }

    let message = `Grazie, richiesta inviata!`;
    if (phoneToggle.checked && phone) {
        message += `<br>Ti chiameremo da <br><strong>${ourPhone}</strong>`;
    } else {
        message += "<br>Riceverai una conferma via email.";
    }
    const formData = {
        firstname,
        lastname,
        email,
        phone,
        energyType,
        contactTime,
        messageForm,
        formType
    };

    setButtonLoading(buttonContactForm, true);
    const result = await postForm(formData);
    if (result.success) {
        showToaster("Grazie, richiesta inviata!");
        setButtonLoading(buttonContactForm, false, "✓ Inviato");
        buttonContactForm.disabled = true;
        buttonContactForm.style.background = '#28a745';
        buttonContactForm.style.cursor = 'not-allowed';
    } else {
        // Show the actual error from GAS, or a fallback
        showToaster(result.message || "Errore durante l'invio", "error");
        showToaster("Errore durante l’invio del modulo", "error");
        setButtonLoading(buttonContactForm, false, "Invia");
    }
    form.reset();
    contactTimeRow.style.display = 'none';
});

newsletterForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const email = this.email.value;
    const formType = "newsletter"
    if (!this.email.checkValidity()) {
        showToaster("Inserisci un'email valida.", "error");
        return;
    }

    let message = `Grazie, richiesta inviata!`;
    const newsletterformData = {
        email,
        formType
    };
    setButtonLoading(buttonNewsletterForm, true);
    const success = await postForm(newsletterformData);
    if (success) {
        showToaster(message);
        setButtonLoading(buttonNewsletterForm, false, '✓ Iscritto');
        buttonNewsletterForm.disabled = true;
        buttonNewsletterForm.style.backgroundColor = '#28a745';
        buttonNewsletterForm.style.cursor = 'not-allowed';
    } else {
        showToaster("Errore durante l’invio del modulo", "error");
        setButtonLoading(buttonNewsletterForm, false, "Iscriviti");
    }
    newsletterForm.reset();
});



async function postForm(payload) {
    try {

        const res = await fetch(`/api/form/submit`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        return {
            success: data.status === "success",
            message: data.message || ""
        };

    } catch (error) {
        return {
            success: false,
            message: "Errore di connessione"
        };
    }
}

function setButtonLoading(button, isLoading, originalText = "Invia") {
    const textEl = button.querySelector(".btn-text");

    if (isLoading) {
        // Lock width once
        if (!button.dataset.widthLocked) {
            button.style.width = button.offsetWidth + "px";
            button.dataset.widthLocked = "true";
        }

        button.classList.add("loading");
        button.disabled = true;

    } else {
        button.classList.remove("loading");
        button.disabled = false;

        if (textEl) textEl.textContent = originalText;
    }
}