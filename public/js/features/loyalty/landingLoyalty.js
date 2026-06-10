(function () {
  'use strict';

  /* ─────────────────────────────────────────
     1. MOBILE BURGER
  ───────────────────────────────────────── */
  const burger = document.getElementById('ecBurger');
  const menu   = document.getElementById('ecMobileMenu');

  if (burger && menu) {
    burger.addEventListener('click', function () {
      const isOpen = menu.classList.toggle('open');
      burger.setAttribute('aria-expanded', String(isOpen));
    });

    // Close when any menu link is clicked
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        menu.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (!menu.contains(e.target) && !burger.contains(e.target)) {
        menu.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      }
    });
  }


  /* ─────────────────────────────────────────
     2. SCROLL REVEAL
  ───────────────────────────────────────── */
  var revealEls = document.querySelectorAll('.ec-reveal');

  if ('IntersectionObserver' in window) {
    var revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('ec-visible');
          revealIO.unobserve(entry.target);
        }
      });
    }, { threshold: 0.10 });

    revealEls.forEach(function (el) { revealIO.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('ec-visible'); });
  }


  /* ─────────────────────────────────────────
     3. ANIMATED COUNTERS
  ───────────────────────────────────────── */
  function animateCounter(el) {
    var target   = parseInt(el.dataset.counter, 10);
    var suffix   = el.dataset.suffix || '';
    var duration = 1400;
    var interval = 16;
    var steps    = duration / interval;
    var inc      = target / steps;
    var current  = 0;

    var tick = setInterval(function () {
      current += inc;
      if (current >= target) {
        current = target;
        clearInterval(tick);
      }
      el.textContent = Math.floor(current).toLocaleString('it-IT') + suffix;
    }, interval);
  }

  var counterEls = document.querySelectorAll('[data-counter]');

  if ('IntersectionObserver' in window) {
    var counterIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterIO.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    counterEls.forEach(function (el) { counterIO.observe(el); });
  } else {
    counterEls.forEach(function (el) {
      el.textContent = parseInt(el.dataset.counter, 10).toLocaleString('it-IT') + (el.dataset.suffix || '');
    });
  }


  /* ─────────────────────────────────────────
     4. FAQ ACCORDION
  ───────────────────────────────────────── */
  document.querySelectorAll('.ec-faq-q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item   = this.closest('.ec-faq-item');
      var isOpen = item.classList.contains('open');

      // Close all
      document.querySelectorAll('.ec-faq-item.open').forEach(function (i) {
        i.classList.remove('open');
        i.querySelector('.ec-faq-q').setAttribute('aria-expanded', 'false');
      });

      // Open this one if it was closed
      if (!isOpen) {
        item.classList.add('open');
        this.setAttribute('aria-expanded', 'true');
      }
    });
  });


  /* ─────────────────────────────────────────
     5. SCROLL HINT — hide on first scroll
  ───────────────────────────────────────── */
  var scrollHint = document.getElementById('ecScrollHint');
  if (scrollHint) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 60) {
        scrollHint.classList.add('hidden');
      }
    }, { passive: true });
  }


  /* ─────────────────────────────────────────
     6. SMOOTH SCROLL FOR ANCHOR LINKS
  ───────────────────────────────────────── */
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var target = document.querySelector(this.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      var navH = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--nav-h'),
        10
      ) || 72;
      var top = target.getBoundingClientRect().top + window.scrollY - navH;
      window.scrollTo({ top: top, behavior: 'smooth' });
    });
  });


  /* ─────────────────────────────────────────
     7. PARTNER FORM SUBMISSION
  ───────────────────────────────────────── */
  var form      = document.getElementById('ecPartnerForm');
  var errBox    = document.getElementById('ecPfError');
  var errMsg    = document.getElementById('ecPfErrorMsg');
  var successEl = document.getElementById('ecPfSuccess');
  var submitBtn = document.getElementById('ecPfSubmit');

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

      if (!name)     { return showError('Inserisci il nome della tua attività.'); }
      if (!email)    { return showError('Inserisci un indirizzo email valido.'); }
      if (!category) { return showError('Seleziona la categoria dell\'attività.'); }

      // Loading state
      submitBtn.classList.add('loading');
      submitBtn.disabled = true;

      try {
        var res = await fetch('/api/loyalty/partner-request', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
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
      } catch (_err) {
        showError('Connessione non riuscita. Contattaci via WhatsApp o per telefono.');
      } finally {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
      }
    });
  }


  /* ─────────────────────────────────────────
     8. CARD QR TIMER — live countdown display
     (purely cosmetic — not a real timer)
  ───────────────────────────────────────── */
  var timerLabel = document.querySelector('.ec-card-timer-label');
  if (timerLabel) {
    var totalSeconds = 300; // 5 minutes
    var remaining    = 222; // start mid-cycle for realism

    setInterval(function () {
      remaining -= 1;
      if (remaining < 0) remaining = totalSeconds;
      var m = Math.floor(remaining / 60);
      var s = remaining % 60;
      timerLabel.textContent = m + ':' + (s < 10 ? '0' : '') + s + ' rimasti';
    }, 1000);
  }

})();
