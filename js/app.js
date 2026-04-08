// TrueAge — Application Logic

window.TrueAge = window.TrueAge || {};

// ─── STATE ──────────────────────────────────────────────────────────────────
let currentLang   = 'en';
let currentScreen = 'landing';
let formData      = {};
let results       = null;

// ─── TRANSLATION HELPER ─────────────────────────────────────────────────────
function t(key) {
  const keys = key.split('.');
  let obj = TRANSLATIONS[currentLang];
  for (const k of keys) {
    if (obj == null) return key;
    obj = obj[k];
  }
  return (obj != null && typeof obj === 'string') ? obj : key;
}

// ─── LANGUAGE ────────────────────────────────────────────────────────────────
function setLang(lang) {
  currentLang = lang;
  document.documentElement.lang = lang;
  const isRTL = lang === 'he';
  document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  document.body.classList.toggle('rtl', isRTL);

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  updateI18n();
}

// ─── SCREEN TRANSITIONS ──────────────────────────────────────────────────────
function showScreen(id) {
  const current = document.querySelector('.screen.active');
  const next    = document.getElementById('screen-' + id);
  if (!next || next === current) return;

  if (current) {
    current.classList.add('exiting');
    setTimeout(() => {
      current.classList.remove('active', 'exiting');
    }, 350);
  }

  setTimeout(() => {
    next.classList.add('active');
    next.scrollTop = 0;
    window.scrollTo(0, 0);
  }, current ? 150 : 0);

  currentScreen = id;
}

// ─── I18N UPDATE ─────────────────────────────────────────────────────────────
function updateI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key  = el.dataset.i18n;
    const text = t(key);
    if (text !== key) el.textContent = text;
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const text = t(el.dataset.i18nPlaceholder);
    if (text) el.placeholder = text;
  });

  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const text = t(el.dataset.i18nHtml);
    if (text) el.innerHTML = text.replace(/\n/g, '<br>');
  });

  // Update unit buttons
  document.querySelectorAll('.unit-btn').forEach(btn => {
    const key  = btn.dataset.unitKey;
    if (key) btn.textContent = t(key);
  });
}

// ─── FORM COLLECTION ─────────────────────────────────────────────────────────
function collectStep1() {
  ['age','height','waist','restingHR','exerciseHR','recoveryHR','bloodPressure'].forEach(f => {
    const el = document.getElementById('input-' + f);
    if (el) formData[f] = el.value.trim();
  });
}

function collectStep2() {
  ['lymphocytes','wbc','mcv','rdw','hemoglobin'].forEach(f => {
    const el = document.getElementById('input-' + f);
    if (el) formData[f] = el.value.trim();
  });
}

// ─── VALIDATION ──────────────────────────────────────────────────────────────
function validateStep1() {
  let valid = true;

  const required = ['age','height','waist','restingHR','exerciseHR','recoveryHR'];
  required.forEach(field => {
    const input = document.getElementById('input-' + field);
    const val   = input ? parseFloat(input.value) : NaN;
    const group = input ? input.closest('.field-group') : null;
    const err   = group ? group.querySelector('.field-error') : null;

    if (!input || isNaN(val) || input.value.trim() === '') {
      if (input)  input.classList.add('error');
      if (err)    err.style.display = 'flex';
      valid = false;
    } else {
      input.classList.remove('error');
      if (err) err.style.display = 'none';
    }
  });

  // Gender
  const genderErr = document.getElementById('gender-error');
  if (!formData.gender) {
    if (genderErr) genderErr.style.display = 'flex';
    valid = false;
  } else {
    if (genderErr) genderErr.style.display = 'none';
  }

  return valid;
}

// ─── RESULTS RENDERING ───────────────────────────────────────────────────────
function renderResults() {
  if (!results) return;
  const r = results;

  updateI18n();

  // Animate bio age number
  animateNumber(document.getElementById('result-bio-age'), 0, r.bioAge, 1400);

  // Chronological age
  const chronoEl = document.getElementById('result-chrono');
  if (chronoEl) chronoEl.textContent = r.chronoAge;

  // Difference display
  const diffEl = document.getElementById('result-diff');
  const absDiff = Math.abs(r.diff);
  let diffText;
  if (absDiff === 0) {
    diffText = t('sameAge');
  } else if (r.diff < 0) {
    diffText = absDiff + ' ' + t('younger');
  } else {
    diffText = absDiff + ' ' + t('older');
  }
  if (diffEl) {
    diffEl.textContent = diffText;
    diffEl.className = 'diff-value ' + (r.diff < -1 ? 'status-good' : r.diff > 1 ? 'status-warn' : 'status-neutral');
  }

  // Ring color & animation
  const ring       = document.querySelector('.age-ring-circle');
  const resultMain = document.querySelector('.result-main');
  const color = r.diff <= -2 ? '#00d4aa' : r.diff > 2 ? '#ff5c5c' : '#f5c842';
  if (ring) {
    ring.style.stroke = color;
    setTimeout(() => {
      const circumference = 2 * Math.PI * 75; // r=75
      const score = Math.min(95, Math.max(15, r.cardioScore));
      ring.style.strokeDashoffset = circumference * (1 - score / 100);
    }, 400);
  }
  if (resultMain) {
    resultMain.dataset.status = r.diff <= -2 ? 'good' : r.diff > 2 ? 'warn' : 'neutral';
  }

  // Glow on bio age number
  const bioAgeNum = document.getElementById('result-bio-age');
  if (bioAgeNum) bioAgeNum.style.color = color;

  // Category bars
  const bars = [
    { id: 'bar-cardio',    score: r.cardioScore,    age: r.cardioAge },
    { id: 'bar-metabolic', score: r.metabolicScore, age: r.metabolicAge },
    { id: 'bar-recovery',  score: r.recoveryScore,  age: r.recoveryAge }
  ];
  bars.forEach((b, i) => {
    const bar   = document.getElementById(b.id);
    const item  = bar ? bar.closest('.category-item') : null;
    const label = item ? item.querySelector('.category-age') : null;
    if (label) label.textContent = b.age + ' yrs';
    setTimeout(() => {
      if (bar) {
        bar.style.width = b.score + '%';
        bar.style.background = scoreToGradient(b.score);
      }
    }, 700 + i * 150);
  });

  // Insight sentence
  const insightEl = document.getElementById('insight-text');
  if (insightEl) insightEl.textContent = TRANSLATIONS[currentLang].insights[r.insightKey] || '';

  // Working / Improve lists
  const workingEl = document.getElementById('working-list');
  const improveEl = document.getElementById('improve-list');
  if (workingEl) {
    workingEl.innerHTML = r.working.length
      ? r.working.map(k => `<li><span class="list-icon good-icon">✓</span>${t(k)}</li>`).join('')
      : `<li><span class="list-icon">—</span>${currentLang === 'ru' ? 'Данных недостаточно' : currentLang === 'he' ? 'אין מספיק נתונים' : 'Not enough data'}</li>`;
  }
  if (improveEl) {
    improveEl.innerHTML = r.improve.length
      ? r.improve.map(k => `<li><span class="list-icon warn-icon">→</span>${t(k)}</li>`).join('')
      : `<li><span class="list-icon">✓</span>${currentLang === 'ru' ? 'Всё отлично!' : currentLang === 'he' ? 'הכל מעולה!' : 'Everything looks great!'}</li>`;
  }
}

// ─── UTILITIES ───────────────────────────────────────────────────────────────
function animateNumber(el, from, to, duration) {
  if (!el) return;
  const start = performance.now();
  function update(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased    = 1 - Math.pow(1 - progress, 4); // quartic ease-out
    el.textContent = Math.round(from + (to - from) * eased);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function scoreToGradient(score) {
  if (score >= 70) return 'linear-gradient(90deg, #00d4aa, #00b894)';
  if (score >= 45) return 'linear-gradient(90deg, #f5c842, #f39c12)';
  return 'linear-gradient(90deg, #ff5c5c, #c0392b)';
}

// ─── RESET ───────────────────────────────────────────────────────────────────
function resetApp() {
  formData = {};
  results  = null;
  document.querySelectorAll('.screen input').forEach(inp => inp.value = '');
  document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.unit-btn').forEach((b, i) => {
    b.classList.toggle('active', i === 0);
  });
  document.querySelectorAll('.field-input').forEach(i => i.classList.remove('error'));
  document.querySelectorAll('.field-error').forEach(e => e.style.display = 'none');
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Language switcher
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => setLang(btn.dataset.lang));
  });

  // Start button
  document.getElementById('btn-start')?.addEventListener('click', () => {
    resetApp();
    showScreen('step1');
  });

  // Gender toggle
  document.querySelectorAll('.gender-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.gender-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      formData.gender = btn.dataset.gender;
      const err = document.getElementById('gender-error');
      if (err) err.style.display = 'none';
    });
  });

  // Step 1 → Step 2
  document.getElementById('btn-next')?.addEventListener('click', () => {
    collectStep1();
    if (validateStep1()) showScreen('step2');
  });

  // Step 2 Skip → Results
  document.getElementById('btn-skip')?.addEventListener('click', () => {
    collectStep2();
    results = TrueAge.calculate(formData);
    showScreen('results');
    setTimeout(renderResults, 300);
  });

  // Step 2 Calculate → Results
  document.getElementById('btn-calculate')?.addEventListener('click', () => {
    collectStep2();
    results = TrueAge.calculate(formData);
    showScreen('results');
    setTimeout(renderResults, 300);
  });

  // Unit toggle (glucose)
  document.querySelectorAll('.unit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Back buttons
  document.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.back));
  });

  // Save (print)
  document.getElementById('btn-save')?.addEventListener('click', () => window.print());

  // Check again
  document.getElementById('btn-recalc')?.addEventListener('click', () => {
    resetApp();
    showScreen('landing');
  });

  // Clear error on input
  document.querySelectorAll('.field-input').forEach(inp => {
    inp.addEventListener('input', () => {
      inp.classList.remove('error');
      const err = inp.closest('.field-group')?.querySelector('.field-error');
      if (err) err.style.display = 'none';
    });
  });

  // Init
  setLang('en');
  showScreen('landing');
});
