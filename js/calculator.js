// TrueAge — Biological Age Calculator
// Based on: PhenoAge (Levine 2018), AHA cardiovascular guidelines, WHO metabolic standards

window.TrueAge = window.TrueAge || {};

TrueAge.calculate = function(data) {
  const age = parseInt(data.age);

  // ─── CARDIOVASCULAR AGE ─────────────────────────────────────────
  let cardioAdj = 0;

  // Resting Heart Rate
  const rhr = parseFloat(data.restingHR);
  if      (rhr < 55)  cardioAdj -= 6;
  else if (rhr < 65)  cardioAdj -= 3;
  else if (rhr <= 75) cardioAdj += 0;
  else if (rhr <= 85) cardioAdj += 4;
  else                cardioAdj += 9;

  // HR Recovery (drop in 1 minute after exercise)
  const hrAfter    = parseFloat(data.exerciseHR);
  const hrRecovery = parseFloat(data.recoveryHR);
  const recoveryDrop = hrAfter - hrRecovery;
  let recoveryAdj = 0;
  if      (recoveryDrop > 25)  recoveryAdj = -4;
  else if (recoveryDrop >= 15) recoveryAdj = -1;
  else if (recoveryDrop >= 10) recoveryAdj =  2;
  else                         recoveryAdj =  6;
  cardioAdj += recoveryAdj;

  // Blood Pressure (optional)
  let bpAdj = 0;
  const bp = parseFloat(data.bloodPressure);
  if (!isNaN(bp) && data.bloodPressure !== '') {
    if      (bp < 120) bpAdj = -3;
    else if (bp < 130) bpAdj =  0;
    else if (bp < 140) bpAdj =  3;
    else               bpAdj =  7;
    cardioAdj += bpAdj;
  }

  const cardioAge = age + cardioAdj;

  // ─── METABOLIC AGE ──────────────────────────────────────────────
  let metabolicAdj = 0;

  // Waist-to-Height Ratio (WHtR)
  const waist  = parseFloat(data.waist);
  const height = parseFloat(data.height);
  const whtr   = waist / height;

  if      (whtr < 0.40) metabolicAdj -= 6;
  else if (whtr < 0.50) metabolicAdj -= 2;
  else if (whtr < 0.55) metabolicAdj += 2;
  else if (whtr < 0.60) metabolicAdj += 5;
  else                  metabolicAdj += 10;

  // Glucose (optional)
  let hasGlucose = false;
  const rawGlucose = parseFloat(data.glucose);
  if (!isNaN(rawGlucose) && data.glucose !== '') {
    hasGlucose = true;
    let glucose = rawGlucose;
    if (data.glucoseUnit === 'mgdl') glucose = glucose / 18.0;
    if      (glucose < 5.0)  metabolicAdj -= 3;
    else if (glucose <= 5.5) metabolicAdj += 0;
    else if (glucose <= 6.0) metabolicAdj += 2;
    else if (glucose <= 6.9) metabolicAdj += 5;
    else                     metabolicAdj += 10;
  }

  // Cholesterol Ratio (optional)
  let hasCholesterol = false;
  const chol = parseFloat(data.cholesterol);
  const hdl  = parseFloat(data.hdl);
  if (!isNaN(chol) && !isNaN(hdl) && hdl > 0 && data.cholesterol !== '' && data.hdl !== '') {
    hasCholesterol = true;
    const ratio = chol / hdl;
    if      (ratio < 3.5) metabolicAdj -= 2;
    else if (ratio <= 4.5) metabolicAdj += 0;
    else if (ratio <= 5.5) metabolicAdj += 3;
    else                   metabolicAdj += 6;
  }

  const metabolicAge = age + metabolicAdj;

  // ─── RECOVERY AGE ───────────────────────────────────────────────
  // Derived from cardiac recovery performance
  const recoveryAge = age + recoveryAdj;

  // ─── COMPOSITE BIO AGE ──────────────────────────────────────────
  const hasBlood = hasGlucose || hasCholesterol;
  let bioAge;
  if (hasBlood) {
    bioAge = Math.round(cardioAge * 0.40 + metabolicAge * 0.40 + recoveryAge * 0.20);
  } else {
    bioAge = Math.round(cardioAge * 0.50 + metabolicAge * 0.30 + recoveryAge * 0.20);
  }

  // ─── COMPONENT SCORES (0–100, higher = biologically younger) ───
  const cardioScore    = adjToScore(cardioAdj);
  const metabolicScore = adjToScore(metabolicAdj);
  const recoveryScore  = adjToScore(recoveryAdj);

  // ─── WHAT'S WORKING / WHAT TO IMPROVE ──────────────────────────
  const working = [];
  const improve = [];

  if (rhr < 65)          working.push('goodHR');        else improve.push('improveHR');
  if (recoveryDrop >= 15) working.push('goodRecovery'); else improve.push('improveRecovery');
  if (whtr < 0.50)       working.push('goodWaist');     else improve.push('improveWaist');

  if (!isNaN(bp) && data.bloodPressure !== '') {
    if (bp < 130) working.push('goodBP'); else improve.push('improveBP');
  }
  if (hasGlucose) {
    let g = rawGlucose;
    if (data.glucoseUnit === 'mgdl') g = g / 18.0;
    if (g < 5.6) working.push('goodGlucose'); else improve.push('improveGlucose');
  }
  if (hasCholesterol) {
    if ((chol / hdl) < 4.5) working.push('goodCholesterol');
    else                     improve.push('improveCholesterol');
  }

  // ─── INSIGHT KEY ────────────────────────────────────────────────
  const diff = bioAge - age;
  let insightKey;
  if      (diff <= -5) insightKey = 'veryYoung';
  else if (diff < -1)  insightKey = 'slightlyYoung';
  else if (diff <= 1)  insightKey = 'onTarget';
  else if (diff <= 4)  insightKey = 'slightlyOld';
  else                 insightKey = 'veryOld';

  return {
    bioAge,
    chronoAge: age,
    diff,
    cardioAge:    Math.round(cardioAge),
    metabolicAge: Math.round(metabolicAge),
    recoveryAge:  Math.round(recoveryAge),
    cardioScore,
    metabolicScore,
    recoveryScore,
    working,
    improve,
    insightKey,
    hasBlood
  };
};

// Map adjustment (negative = younger, positive = older) to 0–100 score
// adj = 0  → score 60 (healthy baseline)
// adj = -15 → score ~97 (excellent)
// adj = +20 → score ~10 (concerning)
function adjToScore(adj) {
  const score = 60 - (adj * 2.5);
  return Math.max(5, Math.min(100, Math.round(score)));
}
