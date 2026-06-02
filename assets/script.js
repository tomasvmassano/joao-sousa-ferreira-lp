/* ==========================================================
   João Sousa Ferreira — LP interactions
   ========================================================== */
(() => {
  'use strict';

  // ---------- year ----------
  document.querySelectorAll('[data-year]').forEach(el => {
    el.textContent = String(new Date().getFullYear());
  });

  // ---------- nav scrolled state ----------
  const nav = document.querySelector('[data-nav]');
  const onScroll = () => {
    if (!nav) return;
    nav.classList.toggle('nav--scrolled', window.scrollY > 8);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- sticky CTA visibility ----------
  const stickyCta = document.querySelector('[data-sticky-cta]');
  const heroEl = document.querySelector('.hero');
  const bookingEl = document.getElementById('agendar');

  if (stickyCta && 'IntersectionObserver' in window) {
    const heroObserver = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        // show after hero leaves view
        if (!e.isIntersecting) stickyCta.classList.add('sticky-cta--visible');
        else stickyCta.classList.remove('sticky-cta--visible');
      });
    }, { rootMargin: '-80px 0px 0px 0px', threshold: 0 });
    heroObserver.observe(heroEl);

    // hide while booking section is on screen
    const bookingObserver = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) stickyCta.classList.remove('sticky-cta--visible');
      });
    }, { threshold: 0.2 });
    bookingObserver.observe(bookingEl);
  }

  // ---------- reveal on scroll ----------
  const revealTargets = document.querySelectorAll(
    '.section-head, .problems__item, .problems__cta, .howto__step, .area, .about__content > *, .faq__item, .booking__aside, .booking__calendly'
  );
  revealTargets.forEach(el => el.classList.add('reveal'));

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealTargets.forEach(el => io.observe(el));
  } else {
    revealTargets.forEach(el => el.classList.add('is-in'));
  }

  // ==========================================================
  // ANALYTICS — Meta Pixel (id 1609154350110510) com mapping para eventos standard
  // ==========================================================
  // Mapa de eventos internos (data-track="…") para eventos standard da Meta.
  // Eventos standard são usados pela Meta para optimização automática de campanhas.
  // Eventos não-mapeados ficam como trackCustom (visíveis no Events Manager mas
  // sem o boost de optimização de bid).
  const STD_EVENT_MAP = {
    // Intent: visitante a iniciar fluxo de marcação
    hero_cta_click:        'Lead',
    nav_cta_click:         'Lead',
    sticky_cta_click:      'Lead',
    mid_cta_click:         'Lead',
    about_cta_click:       'Lead',
    problems_cta_click:    'Lead',
    // Conversion: marcação concluída via Calendly
    booking_confirmed:     'Schedule',
  };
  const track = (event, payload = {}) => {
    const stdEvent = STD_EVENT_MAP[event];
    if (window.fbq) {
      try {
        if (stdEvent) {
          window.fbq('track', stdEvent, payload);
        } else {
          window.fbq('trackCustom', event, payload);
        }
      } catch (_) {}
    }
    // Debug útil em dev
    // console.log('[track]', event, '→', stdEvent || '(custom)', payload);
  };
  document.querySelectorAll('[data-track]').forEach(el => {
    el.addEventListener('click', () => track(el.dataset.track));
  });

  // ---------- Calendly events → Meta Pixel ----------
  // Calendly fires postMessage events ao window quando o utilizador interage
  // com o widget inline. Capturamos os principais para tracking.
  window.addEventListener('message', (e) => {
    if (!e.data || typeof e.data !== 'object') return;
    const ev = e.data.event;
    if (!ev || typeof ev !== 'string' || !ev.startsWith('calendly.')) return;
    switch (ev) {
      case 'calendly.event_type_viewed':
        track('cal_widget_viewed');
        break;
      case 'calendly.date_and_time_selected':
        track('cal_slot_selected');
        break;
      case 'calendly.event_scheduled':
        // CONVERSÃO — booking confirmado. Valor da consulta para optimização de bid.
        track('booking_confirmed', {
          value: 100,
          currency: 'EUR',
          content_name: 'Consulta jurídica',
          content_category: 'Legal consultation',
        });
        break;
    }
  });

  // ---------- cookie banner (Consent Mode v2 stub) ----------
  const cookie = document.querySelector('[data-cookie]');
  const STORAGE_KEY = 'jsf_cookie_consent_v1';
  const consent = localStorage.getItem(STORAGE_KEY);

  if (cookie && !consent) {
    cookie.hidden = false;
    if (stickyCta) stickyCta.classList.add('sticky-cta--with-cookie');
  }

  const setConsent = (mode) => {
    localStorage.setItem(STORAGE_KEY, mode);
    if (cookie) cookie.hidden = true;
    if (stickyCta) stickyCta.classList.remove('sticky-cta--with-cookie');

    // gtag('consent', 'update', { ... }) — integrar quando a tag estiver instalada
    if (mode === 'all' && typeof window.fbq === 'function') {
      try { window.fbq('consent', 'grant'); } catch (_) {}
    }
    track('cookie_consent', { mode });
  };
  cookie?.querySelector('[data-cookie-accept]')?.addEventListener('click', () => setConsent('all'));
  cookie?.querySelector('[data-cookie-essential]')?.addEventListener('click', () => setConsent('essential'));


  // ---------- smooth focus when nav anchors clicked ----------
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').slice(1);
      if (!id) return;
      const t = document.getElementById(id);
      if (!t) return;
      e.preventDefault();
      t.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.pushState(null, '', `#${id}`);
    });
  });
})();
