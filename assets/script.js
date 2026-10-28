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
  const bookingEl = document.getElementById('formulario');

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
    '.section-head, .problems__item, .problems__cta, .howto__step, .why-us__value, .cases__item, .qualify__item, .about__block, .about__content > *, .faq__item, .booking__aside, .booking__form-embed'
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
  // Hierarquia semântica (para o algoritmo aprender bem):
  //   PageView        — load da página (auto via snippet no <head>)
  //   ViewContent     — scroll até ao formulário OU 30s+ na página (interesse)
  //   InitiateCheckout— click num CTA "Quero saber mais / Solicitar contacto" (intenção)
  //   Lead            — submit do formulário GHL (conversão real)
  //
  // Nota: modelo mudou de "consulta única" (Calendly + Schedule) para "sessão gratuita
  // → retainer" (formulário GHL + Lead). Schedule já não faz sentido semantically.
  // ==========================================================
  const STD_EVENT_MAP = {
    // Intent: click em qualquer CTA que aponta para o formulário
    hero_cta_click:        'InitiateCheckout',
    nav_cta_click:         'InitiateCheckout',
    sticky_cta_click:      'InitiateCheckout',
    about_cta_click:       'InitiateCheckout',
    problems_cta_click:    'InitiateCheckout',
    // Lead já NÃO está no mapa — é disparado via window.JSFTrackLead(eventId)
    // com eventID explícito (ver bloco "Lead trigger" mais abaixo). Isto permite
    // deduplicação server-side com Conversions API quando esta existir.
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
  // Sinaliza interesse real (não só o load). Dispara quando:
  //   (a) utilizador faz scroll até à secção do formulário, OU
  //   (b) permanece 30s+ na página — o que vier primeiro.
  let viewContentFired = false;
  const fireViewContent = (source) => {
    if (viewContentFired) return;
    viewContentFired = true;
    if (window.fbq) {
      try {
        window.fbq('track', 'ViewContent', {
          content_name: 'Departamento jurídico externo',
          content_category: 'Legal services',
          source,
        });
      } catch (_) {}
    }
  };
  // (a) Scroll — quando o formulário entra em viewport
  const formSection = document.getElementById('formulario');
  if (formSection && 'IntersectionObserver' in window) {
    const vcObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          fireViewContent('scroll');
          vcObserver.disconnect();
          break;
        }
      }
    }, { threshold: 0.25 });
    vcObserver.observe(formSection);
  }
  // (b) Tempo — 30s na página
  setTimeout(() => fireViewContent('time'), 30_000);

  // ==========================================================
  // Lead trigger — spec SFBA 23/10/2026 (JSF_Correcao_Evento_Lead)
  //
  // 1) Helper global idempotente: dispara 'Lead' uma única vez por event_id,
  //    com eventID explícito (preparado para deduplicação com CAPI).
  // 2) Listener para o iframe GHL: só dispara em callbacks de SUCESSO
  //    confirmado (não em click do botão, não em erros de validação).
  //
  // Critério de aceitação: 1 submissão real = 1 evento Lead.
  //   - NÃO dispara ao carregar a página
  //   - NÃO dispara ao clicar em "enviar" com campos inválidos
  //   - NÃO dispara ao ocorrer erro no envio
  // ==========================================================
  window.JSFTrackLead = (() => {
    const enviados = new Set();
    return (eventId) => {
      if (!eventId || enviados.has(eventId)) return;
      if (typeof window.fbq !== 'function') return;
      enviados.add(eventId);
      // Payload vazio deliberadamente — Meta recomenda não enviar PII do form
      // (nome/e-mail/telefone/empresa) sem base legal e configuração de
      // privacidade apropriadas. O eventID permite dedup com CAPI quando esta
      // for implementada do lado do servidor.
      window.fbq('track', 'Lead', {}, { eventID: eventId });
    };
  })();

  // Listener do iframe GHL.
  // Nota de diagnóstico: o GHL pode usar sub-origens (ex. widget.leadconnectorhq.com,
  // msgsndr.com, services.leadconnectorhq.com) e payloads variáveis. Para evitar
  // perder submissões, aceitamos qualquer origem que termine em leadconnectorhq.com
  // ou msgsndr.com, e logamos SEMPRE o payload em window.__jsf_ghl_msgs para
  // podermos ver a forma real do callback no console.
  window.__jsf_ghl_msgs = window.__jsf_ghl_msgs || [];

  const isGhlOrigin = (origin) => {
    try {
      const u = new URL(origin);
      const h = u.hostname;
      return h === 'api.leadconnectorhq.com'
          || h.endsWith('.leadconnectorhq.com')
          || h.endsWith('.msgsndr.com')
          || h === 'msgsndr.com';
    } catch (_) { return false; }
  };

  window.addEventListener('message', (e) => {
    if (!isGhlOrigin(e.origin)) return;

    // Diagnóstico: guarda o payload completo para inspeção no DevTools.
    try {
      window.__jsf_ghl_msgs.push({ origin: e.origin, data: e.data, t: Date.now() });
      if (window.__jsf_ghl_msgs.length > 50) window.__jsf_ghl_msgs.shift();
      // eslint-disable-next-line no-console
      console.log('[JSF][GHL postMessage]', e.origin, e.data);
    } catch (_) {}

    if (!e.data) return;

    // Normaliza payload: pode vir string, pode vir objecto.
    let payload = e.data;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (_) { /* keep string */ }
    }
    if (typeof payload !== 'object' || payload === null) return;

    const type = String(
      payload.type || payload.event || payload.action || payload.name || ''
    ).toLowerCase();

    // Serializa o payload inteiro em lowercase para fazer match "contains"
    // em qualquer campo (defensivo contra variações do GHL).
    let flat = '';
    try { flat = JSON.stringify(payload).toLowerCase(); } catch (_) {}

    const isSuccess = (
      type === 'jsf_form_success'
      || type.includes('form_submit_success')
      || type.includes('form_submitted')
      || type.includes('form_success')
      || type === 'submitted'
      || type === 'success'
      || (payload.success === true && (type.includes('form') || flat.includes('form')))
      || flat.includes('"form_submit_success"')
      || flat.includes('"formsubmitsuccess"')
      || flat.includes('"formsubmitted"')
    );
    if (!isSuccess) return;

    const eventId = payload.event_id
                 || payload.eventId
                 || payload.submission_id
                 || payload.submissionId
                 || ('jsf_lead_' + (crypto.randomUUID
                                     ? crypto.randomUUID()
                                     : Date.now() + '_' + Math.random().toString(36).slice(2)));

    window.JSFTrackLead(eventId);
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
