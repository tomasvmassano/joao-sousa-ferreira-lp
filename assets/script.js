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
    '.section-head, .problems__item, .howto__step, .area, .about__content > *, .faq__item, .booking__aside, .booking__form'
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

  // ---------- analytics stub ----------
  // Placeholder para Meta Pixel + Conversions API (server-side via gtag/Webhook)
  const track = (event, payload = {}) => {
    if (window.fbq) {
      try { window.fbq('trackCustom', event, payload); } catch (_) {}
    }
    // Debug útil em dev
    // console.log('[track]', event, payload);
  };
  document.querySelectorAll('[data-track]').forEach(el => {
    el.addEventListener('click', () => track(el.dataset.track));
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

  // ==========================================================
  // BOOKING — calendar + slots + form
  // ==========================================================
  const calRoot = document.querySelector('[data-cal]');
  const slotsRoot = document.querySelector('[data-slots]');
  const slotsStep = document.querySelector('[data-slots-step]');
  const formStep = document.querySelector('[data-form-step]');
  const form = document.querySelector('[data-form="booking"]');
  const successEl = document.querySelector('[data-success]');

  if (calRoot && slotsRoot && form) {
    const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const DOW_PT = ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];

    const today = new Date();
    today.setHours(0,0,0,0);
    const lastBookable = new Date(today);
    lastBookable.setDate(lastBookable.getDate() + 60);

    let viewMonth = today.getMonth();
    let viewYear = today.getFullYear();
    let selectedDate = null;
    let selectedSlot = null;

    // Pseudo-disponibilidade: dias úteis com slots variáveis
    const slotsForDate = (d) => {
      const dow = d.getDay(); // 0 Sun .. 6 Sat
      if (dow === 0 || dow === 6) return [];
      const seed = d.getDate() + d.getMonth();
      const base = ['09:30','10:30','11:30','14:30','15:30','16:30','17:30'];
      // remover alguns slots de forma determinística
      return base.filter((_, i) => (seed + i) % 4 !== 0);
    };

    const fmt = (d) => d.toISOString().slice(0, 10);

    const renderCal = () => {
      const first = new Date(viewYear, viewMonth, 1);
      const startDow = (first.getDay() + 6) % 7; // 0 = Mon
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

      const cells = [];
      // leading prev-month days (greyed out)
      for (let i = startDow - 1; i >= 0; i--) {
        cells.push({ day: prevMonthDays - i, out: true });
      }
      // current month
      for (let d = 1; d <= daysInMonth; d++) {
        cells.push({ day: d, out: false });
      }
      // trailing
      while (cells.length % 7 !== 0) cells.push({ day: cells.length - daysInMonth - startDow + 1, out: true });

      const isPrevDisabled =
        viewYear < today.getFullYear() ||
        (viewYear === today.getFullYear() && viewMonth <= today.getMonth());
      const isNextDisabled =
        viewYear > lastBookable.getFullYear() ||
        (viewYear === lastBookable.getFullYear() && viewMonth >= lastBookable.getMonth());

      calRoot.innerHTML = `
        <button type="button" class="cal__nav" data-prev ${isPrevDisabled ? 'disabled' : ''} aria-label="Mês anterior">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="cal__title">${MONTHS_PT[viewMonth]} ${viewYear}</div>
        <button type="button" class="cal__nav" data-next ${isNextDisabled ? 'disabled' : ''} aria-label="Próximo mês">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="cal__grid" role="grid" aria-label="Calendário">
          ${DOW_PT.map(d => `<div class="cal__dow">${d}</div>`).join('')}
          ${cells.map(cell => {
            if (cell.out) return `<span class="cal__day cal__day--out">${cell.day}</span>`;
            const date = new Date(viewYear, viewMonth, cell.day);
            const isPast = date < today;
            const isFuture = date > lastBookable;
            const slots = slotsForDate(date);
            const disabled = isPast || isFuture || slots.length === 0;
            const isToday = date.getTime() === today.getTime();
            const isSelected = selectedDate && fmt(selectedDate) === fmt(date);
            const cls = [
              'cal__day',
              slots.length > 0 && !isPast && !isFuture ? 'cal__day--has-slots' : '',
              isToday ? 'cal__day--today' : '',
              isSelected ? 'cal__day--selected' : ''
            ].filter(Boolean).join(' ');
            return `<button type="button" class="${cls}" data-date="${fmt(date)}" ${disabled ? 'disabled' : ''}>${cell.day}</button>`;
          }).join('')}
        </div>
      `;

      calRoot.querySelector('[data-prev]')?.addEventListener('click', () => {
        viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; }
        renderCal();
      });
      calRoot.querySelector('[data-next]')?.addEventListener('click', () => {
        viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; }
        renderCal();
      });
      calRoot.querySelectorAll('[data-date]').forEach(btn => {
        btn.addEventListener('click', () => {
          const [y, m, d] = btn.dataset.date.split('-').map(Number);
          selectedDate = new Date(y, m - 1, d);
          selectedSlot = null;
          renderSlots();
          renderCal();
          slotsStep.hidden = false;
          slotsStep.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          track('cal_date_selected', { date: btn.dataset.date });
        });
      });
    };

    const renderSlots = () => {
      if (!selectedDate) { slotsRoot.innerHTML = ''; return; }
      const slots = slotsForDate(selectedDate);
      if (slots.length === 0) {
        slotsRoot.innerHTML = `<p class="field__help" style="grid-column:1/-1">Sem horários disponíveis neste dia.</p>`;
        return;
      }
      slotsRoot.innerHTML = slots.map(s => `
        <button type="button" class="slot ${selectedSlot === s ? 'slot--selected' : ''}" data-slot="${s}">${s}</button>
      `).join('');

      slotsRoot.querySelectorAll('[data-slot]').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedSlot = btn.dataset.slot;
          renderSlots();
          formStep.hidden = false;
          formStep.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          track('cal_slot_selected', { date: fmt(selectedDate), slot: selectedSlot });
        });
      });
    };

    renderCal();

    // form submit
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!selectedDate || !selectedSlot) {
        slotsStep.hidden = false;
        alert('Escolhe uma data e um horário antes de continuar.');
        return;
      }
      if (!form.reportValidity()) return;

      const data = Object.fromEntries(new FormData(form).entries());
      data.date = fmt(selectedDate);
      data.slot = selectedSlot;

      track('initiate_checkout', { area: data.area, modality: data.modality });

      // === INTEGRAÇÃO DE PAGAMENTO (a definir) ===============
      // Stripe Checkout, Easypay, MB WAY API ou outro.
      // Substituir o bloco abaixo por chamada ao backend que
      // cria a sessão de pagamento e devolve o redirect URL.
      // =======================================================
      const submitBtn = form.querySelector('[data-submit]');
      submitBtn.disabled = true;
      submitBtn.textContent = 'A processar...';

      setTimeout(() => {
        // simulação de sucesso
        form.querySelectorAll('.booking__step').forEach(s => s.hidden = true);
        successEl.hidden = false;
        successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        track('purchase', { value: 100, currency: 'EUR', area: data.area });
      }, 900);
    });
  }

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
