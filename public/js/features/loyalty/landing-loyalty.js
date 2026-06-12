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


  /* ── 5. FAQ accordion ── */
  document.querySelectorAll('.lc-faq-q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item   = this.closest('.lc-faq-item');
      var isOpen = item.classList.contains('open');

      // Close all
      document.querySelectorAll('.lc-faq-item.open').forEach(function (i) {
        i.classList.remove('open');
        i.querySelector('.lc-faq-q').setAttribute('aria-expanded', 'false');
      });

      // Open clicked if it was closed
      if (!isOpen) {
        item.classList.add('open');
        this.setAttribute('aria-expanded', 'true');
      }
    });
  });


  /* ── 6. Card QR timer countdown (cosmetic) ── */
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
      } catch (_) {
        showError('Connessione non riuscita. Contattaci via WhatsApp o telefono.');
      } finally {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
      }
    });
  }

})();