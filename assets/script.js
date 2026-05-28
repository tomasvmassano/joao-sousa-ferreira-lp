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
    '.section-head, .problems__item, .problems__cta, .howto__step, .howto__timeline, .howto__callout, .area, .about__content > *, .faq__item, .booking__aside, .booking__form, .hero__proof'
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
    // i18n — detecta língua via <html lang="…"> (default pt)
    const LANG = (document.documentElement.lang || 'pt').toLowerCase().slice(0,2);
    const I18N = {
      pt: {
        MONTHS: ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'],
        DOW: ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'],
        PREV: 'Mês anterior', NEXT: 'Próximo mês',
        CAL_LABEL: 'Calendário', NO_SLOTS: 'Sem horários disponíveis neste dia.',
        ALERT_PICK: 'Escolha uma data e um horário antes de continuar.',
        SUBMIT_LOADING: 'A confirmar...',
        TODAY_LABEL: 'hoje', TOMORROW_LABEL: 'amanhã',
        VIEW_MORE: 'Ver mais &rarr;',
        LOCALE: 'pt-PT',
      },
      en: {
        MONTHS: ['January','February','March','April','May','June','July','August','September','October','November','December'],
        DOW: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
        PREV: 'Previous month', NEXT: 'Next month',
        CAL_LABEL: 'Calendar', NO_SLOTS: 'No slots available on this day.',
        ALERT_PICK: 'Please pick a date and time before continuing.',
        SUBMIT_LOADING: 'Confirming...',
        TODAY_LABEL: 'today', TOMORROW_LABEL: 'tomorrow',
        VIEW_MORE: 'See more &rarr;',
        LOCALE: 'en-GB',
      },
    };
    const T = I18N[LANG] || I18N.pt;
    const MONTHS_PT = T.MONTHS;
    const DOW_PT = T.DOW;

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
        <button type="button" class="cal__nav" data-prev ${isPrevDisabled ? 'disabled' : ''} aria-label="${T.PREV}">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7l4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="cal__title">${MONTHS_PT[viewMonth]} ${viewYear}</div>
        <button type="button" class="cal__nav" data-next ${isNextDisabled ? 'disabled' : ''} aria-label="${T.NEXT}">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <div class="cal__grid" role="grid" aria-label="${T.CAL_LABEL}">
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
        slotsRoot.innerHTML = `<p class="field__help" style="grid-column:1/-1">${T.NO_SLOTS}</p>`;
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
    renderSlotsPreview();

    // PRÓXIMOS HORÁRIOS — 3 slots futuros em destaque, acima do calendário
    function renderSlotsPreview() {
      const preview = document.querySelector('[data-slots-preview-list]');
      if (!preview) return;
      const upcoming = [];
      const cursor = new Date(today);
      // varrer próximos 14 dias até reunir 3 slots
      for (let i = 0; i < 14 && upcoming.length < 3; i++) {
        const slots = slotsForDate(cursor);
        if (slots.length > 0) {
          const label = i === 0 ? T.TODAY_LABEL : i === 1 ? T.TOMORROW_LABEL : cursor.toLocaleDateString(T.LOCALE, { weekday: 'short', day: 'numeric' });
          upcoming.push({ date: new Date(cursor), label, time: slots[0] });
          if (slots.length > 1 && upcoming.length < 3) {
            upcoming.push({ date: new Date(cursor), label, time: slots[1] });
          }
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      preview.innerHTML = upcoming.map(u => `
        <li>
          <button type="button" class="slots-preview__slot" data-preview-date="${fmt(u.date)}" data-preview-slot="${u.time}">
            <span class="slots-preview__day">${u.label}</span>
            <span class="slots-preview__time">${u.time}</span>
          </button>
        </li>
      `).join('') + `
        <li>
          <a href="#agendar-cal" class="slots-preview__more" data-track="slots_preview_more">${T.VIEW_MORE}</a>
        </li>
      `;
      preview.querySelectorAll('[data-preview-date]').forEach(btn => {
        btn.addEventListener('click', () => {
          const [y, m, d] = btn.dataset.previewDate.split('-').map(Number);
          selectedDate = new Date(y, m - 1, d);
          selectedSlot = btn.dataset.previewSlot;
          viewMonth = selectedDate.getMonth();
          viewYear = selectedDate.getFullYear();
          renderCal();
          renderSlots();
          slotsStep.hidden = false;
          formStep.hidden = false;
          formStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
          track('slot_preview_selected', { date: btn.dataset.previewDate, slot: btn.dataset.previewSlot });
        });
      });
    }

    // form submit — sem pagamento online, apenas reserva (pagamento por fatura após consulta)
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!selectedDate || !selectedSlot) {
        slotsStep.hidden = false;
        alert(T.ALERT_PICK);
        return;
      }
      if (!form.reportValidity()) return;

      const data = Object.fromEntries(new FormData(form).entries());
      data.date = fmt(selectedDate);
      data.slot = selectedSlot;

      track('initiate_booking', { area: data.area, modality: data.modality });

      // === INTEGRAÇÃO DE BACKEND (a definir) =================
      // POST → endpoint que grava a reserva, envia briefing por e-mail
      // e notifica o João. NÃO há cobrança neste passo — a fatura
      // é emitida após a consulta.
      // =======================================================
      const submitBtn = form.querySelector('[data-submit]');
      submitBtn.disabled = true;
      submitBtn.textContent = T.SUBMIT_LOADING;

      setTimeout(() => {
        // simulação de sucesso
        form.querySelectorAll('.booking__step').forEach(s => s.hidden = true);
        successEl.hidden = false;
        successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        track('booking_confirmed', { value: 100, currency: 'EUR', area: data.area, modality: data.modality });
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
