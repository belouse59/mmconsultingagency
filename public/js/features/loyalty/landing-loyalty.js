(function () {
  'use strict';

  /* ── 1. Nav active state on scroll (same as homepage) ──
     Watches each section with [data-target] and adds .active
     to the matching .nav-link when that section is in view. */
  var sections = document.querySelectorAll('section[id]');
  var navLinks  = document.querySelectorAll('.nav-link[data-target]');

  if ('IntersectionObserver' in window && sections.length) {
    var navIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.id;
        navLinks.forEach(function (link) {
          link.classList.toggle('active', link.dataset.target === id);
        });
      });
    }, {
      rootMargin: '-40% 0px -55% 0px'
    });

    sections.forEach(function (sec) { navIO.observe(sec); });
  }


  /* ── 2. Scroll hint — hide on first scroll ── */
  var scrollHint = document.getElementById('lcScrollHint');
  if (scrollHint) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 60) scrollHint.classList.add('hidden');
    }, { passive: true });
  }


  /* ── 3. Smooth scroll for all anchor links ── */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var target = document.querySelector(this.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      var navH = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--nav-h'),
        10
      ) || 68;
      window.scrollTo({
        top: target.getBoundingClientRect().top + window.scrollY - navH,
        behavior: 'smooth'
      });
    });
  });


  /* ── 4. Counter animation ── */
  function animateCounter(el) {
    var target   = parseInt(el.dataset.counter, 10);
    var suffix   = el.dataset.suffix || '';
    var duration = 1400;
    var fps      = 60;
    var steps    = Math.round(duration / (1000 / fps));
    var inc      = target / steps;
    var current  = 0;

    var tick = setInterval(function () {
      current += inc;
      if (current >= target) {
        el.textContent = target.toLocaleString('it-IT') + suffix;
        clearInterval(tick);
        return;
      }
      el.textContent = Math.floor(current).toLocaleString('it-IT') + suffix;
    }, 1000 / fps);
  }

  var counterEls = document.querySelectorAll('[data-counter]');
  if ('IntersectionObserver' in window) {
    var cIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        animateCounter(e.target);
        cIO.unobserve(e.target);
      });
    }, { threshold: 0.5 });
    counterEls.forEach(function (el) { cIO.observe(el); });
  } else {
    counterEls.forEach(function (el) {
      el.textContent = parseInt(el.dataset.counter, 10)
        .toLocaleString('it-IT') + (el.dataset.suffix || '');
    });
  }


  /* ── 5. Card QR timer countdown (cosmetic) ── */
  var timerLabel = document.getElementById('lcCardTimer');
  if (timerLabel) {
    var remaining = 222; // start mid-cycle for realism

    setInterval(function () {
      remaining -= 1;
      if (remaining < 0) remaining = 300;
      var m = Math.floor(remaining / 60);
      var s = remaining % 60;
      timerLabel.textContent = m + ':' + (s < 10 ? '0' : '') + s + ' rimasti';
    }, 1000);
  }


  /* ── 7. Partner form submission ── */
  var form      = document.getElementById('lcPartnerForm');
  var errBox    = document.getElementById('lcPfError');
  var errMsg    = document.getElementById('lcPfErrorMsg');
  var successEl = document.getElementById('lcPfSuccess');
  var submitBtn = document.getElementById('lcPfSubmit');

  function showError(msg) {
    errMsg.textContent = msg;
    errBox.classList.add('visible');
    successEl.classList.remove('visible');
    errBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearFeedback() {
    errBox.classList.remove('visible');
    successEl.classList.remove('visible');
  }

  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      clearFeedback();

      var name     = form.business_name.value.trim();
      var email    = form.email.value.trim();
      var category = form.category.value;

      if (!name)     return showError('Inserisci il nome della tua attività.');
      if (!email)    return showError('Inserisci un indirizzo email valido.');
      if (!category) return showError('Seleziona la categoria della tua attività.');

      submitBtn.classList.add('loading');
      submitBtn.disabled = true;

      try {
        var res = await fetch('/api/loyalty/partner-request', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body: JSON.stringify({
            business_name: name,
            vat:           form.vat.value.trim(),
            email:         email,
            phone:         form.phone.value.trim(),
            category:      category,
            description:   form.description.value.trim()
          })
        });

        if (res.ok) {
          successEl.classList.add('visible');
          form.reset();
        } else {
          var data = await res.json().catch(function () { return {}; });
          showError(data.message || 'Errore durante l\'invio. Riprova o contattaci direttamente.');
        }
      } catch (_) {
        showError('Connessione non riuscita. Contattaci via WhatsApp o telefono.');
      } finally {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
      }
    });
  }


  /* ─────────────────────────────────────────
     9. LOYALTY CONTACT FORM
     Sends to /api/contacts with source:'loyalty'
     for lead-source tracking in the admin console.
     Reuses the same endpoint and notifyNewLead()
     as the homepage form — no new backend needed.
  ───────────────────────────────────────────── */

  var lcContactForm   = document.getElementById('lcContactForm');
  var lcContactSubmit = document.getElementById('lcContactSubmit');
  var lcContactError  = document.getElementById('lcContactError');
  var lcContactErrMsg = document.getElementById('lcContactErrorMsg');

  // Phone toggle
  var lcPhoneToggle      = document.getElementById('lcPhoneToggle');
  var lcPhoneWrap        = document.getElementById('lcPhoneWrap');
  var lcContactTimeRow   = document.getElementById('lcContactTimeRow');

  if (lcPhoneToggle) {
    lcPhoneToggle.addEventListener('change', function () {
      var on = this.checked;
      this.setAttribute('aria-checked', String(on));
      if (lcPhoneWrap)      lcPhoneWrap.style.display      = on ? '' : 'none';
      if (lcContactTimeRow) lcContactTimeRow.style.display  = on ? '' : 'none';
    });
  }

  function showContactError(msg) {
    if (lcContactErrMsg) lcContactErrMsg.textContent = msg;
    if (lcContactError)  lcContactError.classList.add('visible');
  }

  function hideContactError() {
    if (lcContactError) lcContactError.classList.remove('visible');
  }

  if (lcContactForm) {
    lcContactForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      hideContactError();

      var firstname = (lcContactForm.firstname.value || '').trim();
      var lastname  = (lcContactForm.lastname.value  || '').trim();
      var email     = (lcContactForm.email.value     || '').trim();
      var consent   = document.getElementById('lcConsent');

      if (!firstname || !lastname) {
        showContactError('Inserisci nome e cognome.');
        return;
      }
      if (!email) {
        showContactError('Inserisci un indirizzo email valido.');
        return;
      }
      if (consent && !consent.checked) {
        var errEl = document.getElementById('lcConsentError');
        if (errEl) errEl.classList.add('visible');
        return;
      }

      // Honeypot guard
      var honeypot = lcContactForm.querySelector('[name="company"]');
      if (honeypot && honeypot.value) return;

      if (lcContactSubmit) lcContactSubmit.disabled = true;

      try {
        var payload = {
          firstName:            firstname,
          lastName:             lastname,
          email:                email,
          phone:                (lcContactForm.phone ? lcContactForm.phone.value : '') || '',
          preferredContactTime: lcContactForm.contactTime ? lcContactForm.contactTime.value : '',
          message:              lcContactForm.message ? lcContactForm.message.value.trim() : '',
          // Source tracking — identifies this as a loyalty-page lead
          // in admin reporting and notifyNewLead() emails.
          source:               'loyalty',
          formType:             'loyalty_contact',
        };

        var res = await fetch('/api/contacts', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body:    JSON.stringify(payload),
        });

        if (res.ok) {
          lcContactForm.innerHTML =
            '<div style="text-align:center;padding:32px 0;">' +
            '<p style="font-family:var(--font-display);font-size:1.1rem;font-weight:700;color:var(--text-primary);margin-bottom:8px;">Grazie! Messaggio inviato.</p>' +
            '<p style="font-size:0.9rem;color:var(--text-secondary);">Ti risponderemo entro 24 ore lavorative.</p>' +
            '</div>';
        } else {
          showContactError('Si è verificato un errore. Riprova o contattaci direttamente.');
        }
      } catch (_) {
        showContactError('Connessione non riuscita. Contattaci via WhatsApp o telefono.');
      } finally {
        if (lcContactSubmit) lcContactSubmit.disabled = false;
      }
    });
  }

})();