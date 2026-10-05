/* =====================================================================
   Future Insurance — Core: ולידציות, מסכות קלט, טופס רב-שלבי,
   שליחת לידים, ייחוס קמפיין ואנימציות. משותף לכל דפי הנחיתה.
   ===================================================================== */
(function () {
  'use strict';

  const C = window.SITE_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const nf = new Intl.NumberFormat('he-IL');
  const shekel = n => '₪' + nf.format(Math.round(n));
  const digits = v => String(v == null ? '' : v).replace(/\D/g, '');

  /* ------------------------------------------------------------------
     ולידציות
     ------------------------------------------------------------------ */
  const V = {
    // ת.ז ישראלית — אלגוריתם ספרת ביקורת (לוהן)
    isValidId(v) {
      let id = digits(v);
      if (id.length < 5 || id.length > 9) return false;
      id = id.padStart(9, '0');
      if (/^0+$/.test(id)) return false;
      let sum = 0;
      for (let i = 0; i < 9; i++) {
        let d = Number(id[i]) * ((i % 2) + 1);
        sum += d > 9 ? d - 9 : d;
      }
      return sum % 10 === 0;
    },
    normalizeMobile(v) {
      let d = digits(v);
      if (d.startsWith('972')) d = '0' + d.slice(3);
      return d;
    },
    // נייד ישראלי: 050-059 (ללא 057), 10 ספרות, ללא רצפים/חזרות מזויפים
    isValidMobile(v) {
      const d = V.normalizeMobile(v);
      if (!/^05[0-689]\d{7}$/.test(d)) return false;
      const tail = d.slice(3);
      if (/^(\d)\1{6}$/.test(tail)) return false;
      if ('0123456789'.includes(tail) || '9876543210'.includes(tail)) return false;
      return true;
    },
    parseDate(v) {
      const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(v).trim());
      if (!m) return null;
      const d = +m[1], mo = +m[2], y = +m[3];
      const dt = new Date(y, mo - 1, d);
      if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
      return dt;
    },
    age(dt) {
      const n = new Date();
      let a = n.getFullYear() - dt.getFullYear();
      const m = n.getMonth() - dt.getMonth();
      if (m < 0 || (m === 0 && n.getDate() < dt.getDate())) a--;
      return a;
    },
    isName(v) {
      return /^[א-תa-zA-Z][א-תa-zA-Z'"׳״\-\s]{1,29}$/.test(String(v).trim());
    },
    isPlate(v) {
      const d = digits(v);
      return d.length === 7 || d.length === 8;
    }
  };

  // מחזיר הודעת שגיאה או '' אם תקין
  function checkInput(el) {
    const rule = el.dataset.rule;
    const val = (el.value || '').trim();
    const optional = el.dataset.optional === 'true';
    if (!val && optional) return '';

    switch (rule) {
      case 'name':
        if (!val) return 'שדה חובה';
        return V.isName(val) ? '' : 'נא להזין שם תקין (אותיות בלבד)';
      case 'mobile':
        if (!val) return 'נא להזין מספר נייד';
        return V.isValidMobile(val) ? '' : 'מספר נייד לא תקין (לדוגמה 050-1234567)';
      case 'id':
        if (!val) return 'נא להזין מספר תעודת זהות';
        if (digits(val).length < 9) return 'ת.ז צריכה להכיל 9 ספרות (כולל ספרת ביקורת)';
        return V.isValidId(val) ? '' : 'מספר ת.ז לא תקין — כדאי לבדוק את ספרת הביקורת';
      case 'date': {
        if (!val) return 'נא להזין תאריך';
        const dt = V.parseDate(val);
        if (!dt) return 'תאריך לא תקין (פורמט: יום/חודש/שנה)';
        if (dt > new Date()) return 'התאריך לא יכול להיות עתידי';
        const age = V.age(dt);
        const min = el.dataset.minAge != null ? +el.dataset.minAge : null;
        const max = el.dataset.maxAge != null ? +el.dataset.maxAge : null;
        if (min != null && age < min) return `הגיל המינימלי לבדיקה הוא ${min}`;
        if (max != null && age > max) return `הגיל המקסימלי לבדיקה הוא ${max}`;
        if (el.dataset.after) {
          const ref = document.getElementById(el.dataset.after);
          const refDt = ref && V.parseDate(ref.value);
          if (refDt) {
            // data-after-years: מינימום שנים אחרי תאריך הייחוס (למשל הנפקת ת.ז מגיל 16)
            const limit = new Date(refDt);
            limit.setFullYear(limit.getFullYear() + Number(el.dataset.afterYears || 0));
            if (dt <= refDt || dt < limit) return el.dataset.afterMsg || 'התאריך חייב להיות מאוחר יותר';
          }
        }
        return '';
      }
      case 'money':
      case 'number': {
        if (el.disabled) return '';
        if (!val) return 'שדה חובה';
        const n = Number(digits(val));
        const min = el.dataset.min != null ? +el.dataset.min : -Infinity;
        const max = el.dataset.max != null ? +el.dataset.max : Infinity;
        const unit = rule === 'money' ? '₪' : '';
        if (n < min) return `הערך המינימלי הוא ${unit}${nf.format(min)}`;
        if (n > max) return `הערך המקסימלי הוא ${unit}${nf.format(max)}`;
        return '';
      }
      case 'plate':
        if (!val) return 'נא להזין מספר רכב';
        return V.isPlate(val) ? '' : 'מספר רכב צריך להכיל 7 או 8 ספרות';
      case 'select':
        return val ? '' : 'נא לבחור מהרשימה';
      case 'consent':
        return el.checked ? '' : 'יש לאשר כדי שנוכל לחזור אליך';
      default:
        return val ? '' : 'שדה חובה';
    }
  }

  function validateField(fieldEl, opts = {}) {
    const field = fieldEl.closest('[data-field]') || fieldEl;
    let msg = '';
    if (field.dataset.rule === 'choice') {
      const checked = $$('input[type=radio]', field).some(r => r.checked);
      msg = checked ? '' : 'נא לבחור אפשרות';
    } else {
      const input = field.matches('[data-rule]') && field.tagName !== 'DIV' ? field : $('[data-rule]', field);
      if (!input || input.disabled) { field.classList.remove('is-error', 'is-ok'); return true; }
      msg = checkInput(input);
      if (!msg && typeof opts.extra === 'function') msg = opts.extra(input) || '';
    }
    setFieldState(field, msg);
    return !msg;
  }

  function setFieldState(field, msg) {
    const err = $('.err', field);
    field.classList.toggle('is-error', !!msg);
    field.classList.toggle('is-ok', !msg && !!$('.control, .plate', field));
    if (err) err.textContent = msg;
    const input = $('input, select', field);
    if (input) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  }

  /* ------------------------------------------------------------------
     מסכות קלט (event delegation — עובד גם על שדות שנוספים דינמית)
     ------------------------------------------------------------------ */
  function applyMask(el, e) {
    const mask = el.dataset.mask;
    if (!mask) return;
    const deleting = e && e.inputType && e.inputType.startsWith('delete');
    let d = digits(el.value);
    let out = el.value;
    switch (mask) {
      case 'date':
        if (deleting) return;
        d = d.slice(0, 8);
        out = d.slice(0, 2) + (d.length > 2 ? '/' + d.slice(2, 4) : '') + (d.length > 4 ? '/' + d.slice(4) : '');
        if (d.length === 2 || d.length === 4) out += '/';
        break;
      case 'mobile':
        if (deleting) return;
        if (d.startsWith('972')) d = '0' + d.slice(3);
        d = d.slice(0, 10);
        out = d.length > 3 ? d.slice(0, 3) + '-' + d.slice(3) : d;
        break;
      case 'id':
        out = d.slice(0, 9);
        break;
      case 'money':
        d = d.replace(/^0+/, '').slice(0, 9);
        out = d ? nf.format(Number(d)) : '';
        break;
      case 'digits':
        out = d.slice(0, Number(el.dataset.maxlen || 12));
        break;
      case 'plate':
        if (deleting) return;
        d = d.slice(0, 8);
        out = d.length === 8 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
          : d.length === 7 ? `${d.slice(0, 2)}-${d.slice(2, 5)}-${d.slice(5)}` : d;
        break;
    }
    if (out !== el.value) el.value = out;
  }

  function bindFormBehaviour(form, opts = {}) {
    form.addEventListener('input', e => {
      const el = e.target;
      applyMask(el, e);
      const field = el.closest('[data-field]');
      if (field && (field.classList.contains('is-error') || field.classList.contains('is-ok'))) {
        validateField(field, opts);
      }
    });
    form.addEventListener('focusout', e => {
      const el = e.target;
      if (!el.matches('[data-rule]') || !el.value) return;
      validateField(el.closest('[data-field]'), opts);
      // שדות שתלויים בשדה הזה (data-after) נבדקים מחדש
      if (el.id) $$(`[data-after="${el.id}"]`, form).forEach(dep => { if (dep.value) validateField(dep.closest('[data-field]'), opts); });
    });
    form.addEventListener('change', e => {
      const field = e.target.closest('[data-field]');
      if (field && (e.target.type === 'radio' || e.target.type === 'checkbox' || e.target.tagName === 'SELECT')) validateField(field, opts);
    });
  }

  function validateScope(scope, opts = {}) {
    const fields = $$('[data-field]', scope).filter(f => f.offsetParent !== null || f.dataset.rule === 'choice');
    let firstBad = null;
    fields.forEach(f => {
      if (!validateField(f, opts) && !firstBad) firstBad = f;
    });
    if (firstBad) {
      firstBad.classList.remove('shake'); void firstBad.offsetWidth; firstBad.classList.add('shake');
      const focusable = $('input:not([type=radio]), select', firstBad) || $('input', firstBad);
      if (focusable) focusable.focus({ preventScroll: true });
      const r = firstBad.getBoundingClientRect();
      if (r.top < 80 || r.bottom > window.innerHeight) firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return !firstBad;
  }

  /* ------------------------------------------------------------------
     טופס רב-שלבי
     ------------------------------------------------------------------ */
  function initWizard(form, opts = {}) {
    const steps = $$('.step', form);
    const pSteps = $$('.p-step', form);
    const fill = $('.progress-fill', form);
    let cur = 0;

    function show(i, dir = 1) {
      steps[cur].classList.remove('active', 'back');
      cur = Math.max(0, Math.min(i, steps.length - 1));
      steps[cur].classList.add('active');
      steps[cur].classList.toggle('back', dir < 0);
      pSteps.forEach((p, idx) => {
        p.classList.toggle('active', idx === cur);
        p.classList.toggle('done', idx < cur);
      });
      if (fill) {
        const span = 100 * cur / Math.max(1, steps.length - 1);
        fill.style.width = `calc((100% - 32px) * ${span / 100})`;
      }
      const card = form.closest('.lead-card') || form;
      const top = card.getBoundingClientRect().top;
      if (top < 0) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (opts.onStep) opts.onStep(cur, steps[cur]);
      track('form_step', { step: cur + 1 });
    }

    form.addEventListener('click', e => {
      const next = e.target.closest('[data-next]');
      const back = e.target.closest('[data-back]');
      if (next) {
        e.preventDefault();
        if (validateScope(steps[cur], opts) && (!opts.beforeNext || opts.beforeNext(cur) !== false)) show(cur + 1, 1);
      } else if (back) {
        e.preventDefault();
        show(cur - 1, -1);
      }
    });

    // Enter בשדה = מעבר לשלב הבא במקום שליחה מוקדמת
    form.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT' && cur < steps.length - 1) {
        e.preventDefault();
        const nb = $('[data-next]', steps[cur]);
        if (nb) nb.click();
      }
    });

    show(0);
    return {
      get current() { return cur; },
      goTo: show,
      validateCurrent: () => validateScope(steps[cur], opts),
      validateAll() {
        for (let i = 0; i < steps.length; i++) {
          steps[i].classList.add('active');
          const ok = validateScope(steps[i], opts);
          steps[i].classList.remove('active');
          if (!ok) { show(i, -1); validateScope(steps[i], opts); return false; }
        }
        steps[cur].classList.add('active');
        return true;
      }
    };
  }

  /* ------------------------------------------------------------------
     מבוטחים נוספים (repeater)
     ------------------------------------------------------------------ */
  function initRepeater({ container, template, addBtn, max = 3, onChange }) {
    let seq = 0;
    const tpl = template.innerHTML;

    function refresh() {
      const blocks = $$('.insured-block', container);
      blocks.forEach((b, i) => { const t = $('[data-title]', b); if (t) t.textContent = `מבוטח/ת נוסף/ת ${blocks.length > 1 ? i + 1 : ''}`.trim(); });
      addBtn.hidden = blocks.length >= max;
      if (onChange) onChange(blocks.length);
    }
    function add(prefill = {}) {
      if ($$('.insured-block', container).length >= max) return null;
      seq++;
      const wrap = document.createElement('div');
      wrap.innerHTML = tpl.replace(/__i__/g, seq).trim();
      const block = wrap.firstElementChild;
      container.appendChild(block);
      Object.entries(prefill).forEach(([k, v]) => {
        const el = $(`[data-key="${k}"]`, block);
        if (!el) return;
        if (el.type === 'radio') { const r = $(`[data-key="${k}"][value="${v}"]`, block); if (r) r.checked = true; }
        else el.value = v;
      });
      refresh();
      track('add_insured');
      return block;
    }
    container.addEventListener('click', e => {
      const rm = e.target.closest('[data-remove]');
      if (!rm) return;
      const block = rm.closest('.insured-block');
      block.style.transition = 'opacity .25s, transform .25s';
      block.style.opacity = '0'; block.style.transform = 'scale(.97)';
      setTimeout(() => { block.remove(); refresh(); }, 230);
    });
    addBtn.addEventListener('click', () => {
      const b = add();
      if (b) { const f = $('input', b); if (f) f.focus({ preventScroll: true }); b.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    });
    refresh();
    return {
      add,
      count: () => $$('.insured-block', container).length,
      collect() {
        return $$('.insured-block', container).map(b => {
          const o = {};
          $$('[data-key]', b).forEach(el => {
            if (el.type === 'radio') { if (el.checked) o[el.dataset.key] = el.value; }
            else o[el.dataset.key] = el.value.trim();
          });
          return o;
        });
      }
    };
  }

  /* ------------------------------------------------------------------
     ייחוס קמפיין (UTM / gclid) — נשמר לאורך הסשן
     ------------------------------------------------------------------ */
  const ATTR_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'gbraid', 'wbraid', 'fbclid'];
  function captureAttribution() {
    try {
      const params = new URLSearchParams(location.search);
      const stored = JSON.parse(sessionStorage.getItem('lp_attr') || '{}');
      let changed = false;
      ATTR_KEYS.forEach(k => { const v = params.get(k); if (v) { stored[k] = v; changed = true; } });
      if (!stored.landingPage) { stored.landingPage = location.href.split('#')[0]; stored.referrer = document.referrer || ''; changed = true; }
      if (changed) sessionStorage.setItem('lp_attr', JSON.stringify(stored));
    } catch (_) { /* sessionStorage חסום — מתעלמים */ }
  }
  function getAttribution() {
    try { return JSON.parse(sessionStorage.getItem('lp_attr') || '{}'); } catch (_) { return {}; }
  }

  function track(event, params = {}) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event }, params));
  }

  /* ------------------------------------------------------------------
     שליחת ליד
     ------------------------------------------------------------------ */
  let sending = false;
  async function submitLead(payload, { form, button, thankYou = 'thank-you.html', source = '' } = {}) {
    if (sending) return;
    // honeypot — בוטים ממלאים שדות מוסתרים
    const hp = form && $('.hp-field input', form);
    if (hp && hp.value) { location.href = thankYou; return; }

    sending = true;
    if (button) { button.disabled = true; button.classList.add('loading'); }

    // ראיה להסכמה: הנוסח המדויק שאושר, גרסת המסמכים והסכמה לדיוור (אופציונלית)
    const consentEl = form && $('#consent', form);
    const mkt = form && $('#marketingConsent', form);
    const consent = consentEl ? {
      consentText: (consentEl.closest('label') || consentEl.parentElement).textContent.replace(/\s+/g, ' ').trim(),
      consentVersion: C.legalVersion || '',
      marketingConsent: mkt && mkt.checked ? 'כן' : 'לא'
    } : {};

    const full = Object.assign({
      submittedAt: new Date().toISOString(),
      submittedAtLocal: new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }),
      device: /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
    }, payload, consent, getAttribution());

    try {
      if (!/^https:\/\/script\.google\.com\//.test(C.scriptUrl || '')) throw new Error('scriptUrl not configured');
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 12000);
      // text/plain מונע preflight; ב-Apps Script קוראים e.postData.contents
      await fetch(C.scriptUrl, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(full), signal: ctrl.signal
      });
      clearTimeout(t);
      track('generate_lead', { lead_source: payload.pageSource });
      try {
        sessionStorage.setItem('lead_first_name', payload.firstName || '');
        sessionStorage.setItem('lead_source', source);
        sessionStorage.setItem('lead_conv_pending', '1');
      } catch (_) {}
      location.href = thankYou + (source ? '?src=' + encodeURIComponent(source) : '');
    } catch (err) {
      console.error('[Future Insurance] שליחת הליד נכשלה:', err);
      sending = false;
      if (button) { button.disabled = false; button.classList.remove('loading'); }
      showFallback(form, full);
    }
  }

  function waLink(text) {
    return `https://wa.me/${C.whatsappNumber}?text=${encodeURIComponent(text)}`;
  }

  function showFallback(form, p) {
    const fb = form && form.parentElement.querySelector('.fallback');
    if (!fb) { alert('אירעה תקלה בשליחה. אפשר להתקשר אלינו: ' + C.phoneDisplay); return; }
    // ללא ת.ז בהודעת וואטסאפ — מידע רגיש לא עובר בערוץ הזה
    const lines = [`היי, השארתי פרטים בדף "${p.pageSource}" ואשמח לבדיקה.`, `שם: ${p.firstName || ''} ${p.lastName || ''}`, `נייד: ${p.phone || ''}`];
    const a = $('[data-wa-fallback]', fb);
    if (a) a.href = waLink(lines.join('\n'));
    form.hidden = true;
    fb.classList.add('show');
    const retry = $('[data-retry]', fb);
    if (retry) retry.onclick = () => { fb.classList.remove('show'); form.hidden = false; };
  }

  /* ------------------------------------------------------------------
     אנימציות ו-UI כלליים
     ------------------------------------------------------------------ */
  function animateNumber(el, to, { duration = 900, format = v => nf.format(Math.round(v)) } = {}) {
    const from = Number(el.dataset.cur || 0);
    el.dataset.cur = to;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = format(to); return; }
    const start = performance.now();
    cancelAnimationFrame(el._raf);
    const step = now => {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      el.textContent = format(from + (to - from) * e);
      if (t < 1) el._raf = requestAnimationFrame(step);
    };
    el._raf = requestAnimationFrame(step);
  }

  function initReveal() {
    const els = $$('[data-reveal]');
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        $$('[data-count]', en.target).concat(en.target.matches('[data-count]') ? [en.target] : []).forEach(c => {
          if (c._done) return; c._done = true;
          animateNumber(c, Number(c.dataset.count), { duration: 1600, format: v => (c.dataset.prefix || '') + nf.format(Math.round(v)) + (c.dataset.suffix || '') });
        });
        io.unobserve(en.target);
      });
    }, { threshold: .15, rootMargin: '0px 0px -40px 0px' });
    els.forEach(e => io.observe(e));
  }

  function initHeader() {
    const h = $('.site-header');
    if (!h) return;
    const on = () => h.classList.toggle('scrolled', window.scrollY > 30);
    on(); window.addEventListener('scroll', on, { passive: true });
  }

  // CTA דביק במובייל: מופיע כשהטופס לא בתצוגה
  function initStickyCta(target) {
    const bar = $('.sticky-cta');
    if (!bar || !target || !('IntersectionObserver' in window)) return;
    let formVisible = true;
    const io = new IntersectionObserver(([en]) => { formVisible = en.isIntersecting; update(); }, { threshold: .1 });
    io.observe(target);
    const update = () => bar.classList.toggle('show', !formVisible && window.scrollY > 300);
    window.addEventListener('scroll', update, { passive: true });
  }

  function initContactLinks() {
    $$('[data-tel]').forEach(a => { a.href = 'tel:' + C.phoneTel; });
    $$('[data-tel-text]').forEach(a => { a.textContent = C.phoneDisplay; });
    $$('[data-wa]').forEach(a => {
      a.href = waLink(a.dataset.wa || 'היי, אשמח לבדיקת חיסכון בביטוח');
      a.target = '_blank'; a.rel = 'noopener';
    });
    $$('[data-tel], [data-wa]').forEach(a => a.addEventListener('click', () => track(a.hasAttribute('data-wa') ? 'whatsapp_click' : 'phone_click')));
  }

  function initA11y() {
    const btn = $('.a11y-btn'), panel = $('.a11y-panel');
    if (!btn || !panel) return;
    btn.addEventListener('click', () => { const o = panel.classList.toggle('open'); btn.setAttribute('aria-expanded', o); });
    // ההעדפות נשמרות בין ביקורים ובין הדפים
    const saved = (store.get('fi_a11y') || '').split(',').filter(Boolean);
    const persist = () => store.set('fi_a11y', $$('[data-a11y]', panel).filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.a11y).join(','));
    $$('[data-a11y]', panel).forEach(b => {
      const cls = 'a11y-' + b.dataset.a11y;
      if (saved.includes(b.dataset.a11y)) { document.documentElement.classList.add(cls); b.setAttribute('aria-pressed', 'true'); }
      b.addEventListener('click', () => {
        const on = document.documentElement.classList.toggle(cls);
        b.setAttribute('aria-pressed', on);
        persist();
      });
    });
    const reset = $('[data-a11y-reset]', panel);
    if (reset) reset.addEventListener('click', () => {
      $$('[data-a11y]', panel).forEach(b => { document.documentElement.classList.remove('a11y-' + b.dataset.a11y); b.setAttribute('aria-pressed', 'false'); });
      persist();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') panel.classList.remove('open'); });
  }

  function initTestiDots() {
    const track_ = $('.testis'), dots = $$('.dots i');
    if (!track_ || !dots.length) return;
    track_.addEventListener('scroll', () => {
      const cards = $$('.testi', track_);
      const mid = track_.getBoundingClientRect().left + track_.clientWidth / 2;
      let best = 0, bestD = Infinity;
      cards.forEach((c, i) => { const r = c.getBoundingClientRect(); const d = Math.abs(r.left + r.width / 2 - mid); if (d < bestD) { bestD = d; best = i; } });
      dots.forEach((d, i) => d.classList.toggle('on', i === best));
    }, { passive: true });
  }

  /* ------------------------------------------------------------------
     עוגיות + Google Consent Mode v2
     ------------------------------------------------------------------ */
  const CONSENT_KEY = 'fi_cookie_consent_v1';
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  };
  const consentFor = choice => {
    const g = choice === 'all' ? 'granted' : 'denied';
    return { ad_storage: g, ad_user_data: g, ad_personalization: g, analytics_storage: g };
  };
  function currentChoice() {
    return store.get(CONSENT_KEY) || (C.cookieMode === 'opt-in' ? 'essential' : 'all');
  }

  function initCookieBar() {
    const bar = document.createElement('div');
    bar.className = 'cookie-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'הודעה על שימוש בעוגיות');
    bar.innerHTML = '<p><b>האתר משתמש בעוגיות 🍪</b> לתפעול הדף, למדידה ולפרסום מותאם (Google). ' +
      '<a href="privacy.html#cookies" data-legal="cookies">למדיניות העוגיות</a></p>' +
      '<div class="cb-actions"><button type="button" class="cb-decline">רק חיוניות</button>' +
      '<button type="button" class="btn btn-gold cb-accept">מאשר/ת</button></div>';
    document.body.appendChild(bar);
    const show = () => { bar.classList.add('show'); document.body.classList.add('has-cookie-bar'); };
    const choose = choice => {
      store.set(CONSENT_KEY, choice);
      window.gtag('consent', 'update', consentFor(choice));
      track('cookie_consent', { choice });
      bar.classList.remove('show'); document.body.classList.remove('has-cookie-bar');
    };
    $('.cb-accept', bar).addEventListener('click', () => choose('all'));
    $('.cb-decline', bar).addEventListener('click', () => choose('essential'));
    document.addEventListener('click', e => { if (e.target.closest('[data-cookie-settings]')) { e.preventDefault(); show(); } });
    if (!store.get(CONSENT_KEY)) setTimeout(show, 900);
  }

  function loadTags() {
    // ברירת המחדל של ההסכמה חייבת להיקבע לפני טעינת תגי Google
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', Object.assign(consentFor(currentChoice()), { wait_for_update: 500 }));
    if (C.gtmId) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      const s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtm.js?id=' + C.gtmId; document.head.appendChild(s);
    }
    if (C.gtagId) {
      const s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + C.gtagId; document.head.appendChild(s);
      window.gtag('js', new Date()); window.gtag('config', C.gtagId);
    }
  }

  /* ------------------------------------------------------------------
     מסמכים משפטיים: חלון קופץ שנטען מ-privacy.html (מקור אחד לכל הדפים)
     ------------------------------------------------------------------ */
  function fillConfig(root = document) {
    $$('[data-license]', root).forEach(e => { e.textContent = C.licenseNumber || ''; });
    $$('[data-agent]', root).forEach(e => { e.textContent = C.agentName || ''; });
    $$('[data-updated]', root).forEach(e => { e.textContent = C.legalUpdated || ''; });
    $$('[data-coordinator]', root).forEach(e => { e.textContent = C.accessibilityCoordinator || C.agentName || ''; });
    $$('[data-email]', root).forEach(e => {
      if (!C.email) { (e.closest('[data-email-wrap]') || e).hidden = true; return; }
      e.textContent = C.email; if (e.tagName === 'A') e.href = 'mailto:' + C.email;
    });
    $$('[data-tel]', root).forEach(a => { a.href = 'tel:' + C.phoneTel; });
    $$('[data-tel-text]', root).forEach(a => { a.textContent = C.phoneDisplay; });
  }

  let legalDoc = null, legalDlg = null;
  function legalDialog() {
    if (legalDlg) return legalDlg;
    legalDlg = document.createElement('dialog');
    legalDlg.className = 'legal-modal';
    legalDlg.setAttribute('aria-labelledby', 'legalTitle');
    legalDlg.innerHTML = '<div class="lm-wrap"><div class="lm-head"><h2 id="legalTitle"></h2>' +
      '<button type="button" class="lm-close" aria-label="סגירת החלון">✕</button></div>' +
      '<div class="lm-body" tabindex="0"></div>' +
      '<div class="lm-foot"><a class="lm-full" target="_blank" rel="noopener">פתיחה בעמוד מלא</a>' +
      '<button type="button" class="btn btn-gold lm-ok">הבנתי</button></div></div>';
    document.body.appendChild(legalDlg);
    legalDlg.addEventListener('click', e => {
      if (e.target === legalDlg || e.target.closest('.lm-close, .lm-ok')) legalDlg.close();
    });
    legalDlg.addEventListener('close', () => document.documentElement.classList.remove('modal-open'));
    return legalDlg;
  }
  async function openLegal(key, href) {
    try {
      if (typeof HTMLDialogElement === 'undefined') throw new Error('no dialog');
      if (!legalDoc) {
        const r = await fetch('privacy.html', { cache: 'no-cache' });
        if (!r.ok) throw new Error('fetch failed');
        legalDoc = new DOMParser().parseFromString(await r.text(), 'text/html');
      }
      const sec = legalDoc.getElementById(key);
      if (!sec) throw new Error('missing section');
      const d = legalDialog();
      const clone = sec.cloneNode(true);
      const h = clone.querySelector('h1, h2');
      $('#legalTitle', d).textContent = h ? h.textContent : '';
      if (h) h.remove();
      const body = $('.lm-body', d);
      body.innerHTML = ''; body.appendChild(clone); fillConfig(body);
      $('.lm-full', d).href = 'privacy.html#' + key;
      if (!d.open) d.showModal();
      document.documentElement.classList.add('modal-open');
      body.scrollTop = 0;
      track('legal_open', { doc: key });
    } catch (_) {
      location.href = href; // גיבוי: פתיחת העמוד המלא
    }
  }
  function initLegal() {
    document.addEventListener('click', e => {
      const a = e.target.closest('[data-legal]');
      if (!a) return;
      e.preventDefault();
      e.stopPropagation(); // לא לסמן את תיבת ההסכמה כשלוחצים על קישור בתוכה
      openLegal(a.dataset.legal, a.getAttribute('href') || 'privacy.html');
    });
  }

  // הסתרת תמונות שלא נטענו כדי שלא יופיע אייקון שבור
  function guardImages() {
    $$('img').forEach(img => img.addEventListener('error', () => { img.style.visibility = 'hidden'; }, { once: true }));
  }

  function boot() {
    loadTags();
    captureAttribution();
    initHeader();
    initReveal();
    initContactLinks();
    fillConfig();
    initLegal();
    initCookieBar();
    initA11y();
    initTestiDots();
    guardImages();
    const y = $('[data-year]'); if (y) y.textContent = new Date().getFullYear();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.LP = { fillConfig, openLegal, $, $$, nf, shekel, digits, V, validateField, validateScope, setFieldState, bindFormBehaviour, initWizard, initRepeater, submitLead, animateNumber, initStickyCta, track, waLink };
})();
