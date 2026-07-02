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
  // ANALYTICS — Meta Pixel (id 1609154350110510)
  //
  // Hierarquia semântica dos eventos (para o algoritmo aprender bem):
  //   PageView        — carregamento da página (automático via snippet no head)
  //   ViewContent     — scroll até ao Calendly OU 30s+ na página (sinal de interesse)
  //   InitiateCheckout— click num CTA "Agendar" (intenção, NÃO conversão)
  //   Schedule        — calendly.event_scheduled (conversão real, agendamento feito)
  //
  // Nota: os CTAs disparavam "Lead" antes, o que fazia o algoritmo optimizar para
  // cliques em vez de agendamentos. Substituído por InitiateCheckout — semanticamente
  // mais correto e o algoritmo lida melhor com ele em campanhas de Sales/Leads.
  // ==========================================================
  const STD_EVENT_MAP = {
    // Intent: click num CTA "Agendar consulta" — abre/foca o Calendly
    hero_cta_click:        'InitiateCheckout',
    nav_cta_click:         'InitiateCheckout',
    sticky_cta_click:      'InitiateCheckout',
    mid_cta_click:         'InitiateCheckout',
    about_cta_click:       'InitiateCheckout',
    problems_cta_click:    'InitiateCheckout',
    // Conversion: marcação confirmada via Calendly (event_scheduled)
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

  // ---------- ViewContent — dispara UMA vez por sessão, no primeiro dos triggers ----------
  // Sinaliza interesse real (não só o load da página). Dispara quando:
  //   (a) o utilizador faz scroll até à secção do Calendly, OU
  //   (b) permanece 30s+ na página, o que aconteça primeiro.
  let viewContentFired = false;
  const fireViewContent = (source) => {
    if (viewContentFired) return;
    viewContentFired = true;
    if (window.fbq) {
      try {
        window.fbq('track', 'ViewContent', {
          content_name: 'Consulta jurídica',
          content_category: 'Legal consultation',
          source, // debug: 'scroll' ou 'time'
        });
      } catch (_) {}
    }
  };
  // (a) Trigger por scroll — quando o Calendly entra em viewport
  const bookingSection = document.getElementById('agendar');
  if (bookingSection && 'IntersectionObserver' in window) {
    const vcObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          fireViewContent('scroll');
          vcObserver.disconnect();
          break;
        }
      }
    }, { threshold: 0.25 });
    vcObserver.observe(bookingSection);
  }
  // (b) Trigger por tempo — 30s na página
  setTimeout(() => fireViewContent('time'), 30_000);

  // ---------- Calendly events → Meta Pixel ----------
  // Calendly envia eventos via postMessage ao window pai. Filtramos por origin
  // https://calendly.com para garantir que só reagimos a mensagens do iframe correto
  // (não a mensagens de outros scripts com o mesmo formato).
  const isCalendlyEvent = (e) => (
    e.origin === 'https://calendly.com'
    && e.data && typeof e.data === 'object'
    && typeof e.data.event === 'string'
    && e.data.event.indexOf('calendly.') === 0
  );
  window.addEventListener('message', (e) => {
    if (!isCalendlyEvent(e)) return;
    switch (e.data.event) {
      case 'calendly.event_type_viewed':
        track('cal_widget_viewed');
        break;
      case 'calendly.date_and_time_selected':
        track('cal_slot_selected');
        break;
      case 'calendly.event_scheduled':
        // CONVERSÃO — booking confirmado. Standard event 'Schedule' com value.
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
