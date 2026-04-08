// TrueAge — Biological Age Calculator
// Primary formula: PhenoAge (Levine et al., 2018) — validated on NHANES III
// Supplemented by: AHA cardiovascular guidelines, WHO metabolic standards

window.TrueAge = window.TrueAge || {};

TrueAge.calculate = function(data) {
  const age = parseInt(data.age);

  // ═══════════════════════════════════════════════════════════════
  // PART 1 — CARDIOVASCULAR AGE
  // Based on: AHA heart rate recovery standards
  // ═══════════════════════════════════════════════════════════════
  let cardioAdj = 0;

  // Resting Heart Rate
  const rhr = parseFloat(data.restingHR);
  if      (rhr < 55)  cardioAdj -= 6;
  else if (rhr < 65)  cardioAdj -= 3;
  else if (rhr <= 75) cardioAdj += 0;
  else if (rhr <= 85) cardioAdj += 4;
  else                cardioAdj += 9;

  // HR Recovery (drop in 1 minute)
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

  // ═══════════════════════════════════════════════════════════════
  // PART 2 — PHENOAGE (Levine 2018)
  // Uses 8 biomarkers from CBC + biochemistry
  // Paper: https://doi.org/10.18632/aging.101414
  // Coefficients from Table 2 of Levine et al., 2018
  // ═══════════════════════════════════════════════════════════════

  // Collect available biomarkers
  const lymph    = parseFloat(data.lymphocytes);  // LYM%
  const wbc      = parseFloat(data.wbc);          // K/ul = ×10³/µL
  const mcv      = parseFloat(data.mcv);          // fL
  const rdw      = parseFloat(data.rdw);          // %
  const glucose  = parseFloat(data.glucose);      // mg/dL
  const albumin  = parseFloat(data.albumin);      // g/dL
  const creat    = parseFloat(data.creatinine);   // mg/dL
  const alkphos  = parseFloat(data.alkphos);      // U/L
  const chol     = parseFloat(data.cholesterol);  // mg/dL
  const hdl      = parseFloat(data.hdl);          // mg/dL

  const hasLymph   = !isNaN(lymph)   && data.lymphocytes  !== '';
  const hasWBC     = !isNaN(wbc)     && data.wbc          !== '';
  const hasMCV     = !isNaN(mcv)     && data.mcv          !== '';
  const hasRDW     = !isNaN(rdw)     && data.rdw          !== '';
  const hasGlucose = !isNaN(glucose) && data.glucose      !== '';
  const hasAlbumin = !isNaN(albumin) && data.albumin      !== '';
  const hasCreat   = !isNaN(creat)   && data.creatinine   !== '';
  const hasAlkphos = !isNaN(alkphos) && data.alkphos      !== '';
  const hasChol    = !isNaN(chol)    && data.cholesterol  !== '';
  const hasHDL     = !isNaN(hdl)     && data.hdl          !== '';

  const bloodMarkersCount = [hasLymph,hasWBC,hasMCV,hasRDW,hasGlucose,hasAlbumin,hasCreat,hasAlkphos].filter(Boolean).length;
  const hasBlood = bloodMarkersCount >= 2;

  let phenoBioAge = null;

  if (hasBlood) {
    // PhenoAge xb linear combination
    // Intercept: -19.9067
    // Units: albumin g/dL, creatinine µmol/L (×88.4), glucose mmol/L (/18),
    //        CRP log(mg/dL) — use healthy default if missing,
    //        lymph %, MCV fL, RDW %, ALP U/L, WBC ×10³/µL
    let xb = -19.9067;

    // Albumin (g/dL): coefficient -0.0336
    xb += hasAlbumin ? (-0.0336 * albumin) : (-0.0336 * 4.3); // healthy default

    // Creatinine (convert mg/dL → µmol/L): coefficient +0.0095
    const creatUmol = hasCreat ? creat * 88.4 : 80.0;
    xb += 0.0095 * creatUmol;

    // Glucose (convert mg/dL → mmol/L): coefficient -0.1953
    const glucoseMmol = hasGlucose ? glucose / 18.0 : 5.0;
    xb += -0.1953 * glucoseMmol;

    // CRP log(mg/dL): coefficient +0.0954 — use healthy default (CRP ~0.3 mg/dL)
    xb += 0.0954 * Math.log(0.3);

    // Lymphocyte %: coefficient -0.0120
    xb += hasLymph ? (-0.0120 * lymph) : (-0.0120 * 30);

    // MCV (fL): coefficient +0.0268
    xb += hasMCV ? (0.0268 * mcv) : (0.0268 * 90);

    // RDW (%): coefficient +0.3306
    xb += hasRDW ? (0.3306 * rdw) : (0.3306 * 13.0);

    // Alkaline Phosphatase (U/L): coefficient +0.00188
    xb += hasAlkphos ? (0.00188 * alkphos) : (0.00188 * 70);

    // WBC (×10³/µL): coefficient +0.0554
    xb += hasWBC ? (0.0554 * wbc) : (0.0554 * 6.0);

    // Mortality score M
    const gamma  = 0.0076927;
    const lambda = 0.000035933;
    const M = 1 - Math.exp(-gamma / lambda * Math.exp(xb) * (1 - Math.exp(-lambda * age)));

    // Convert M to PhenoAge (biological age)
    const clampedM = Math.min(Math.max(M, 0.0001), 0.9999);
    phenoBioAge = 141.50 + Math.log(-0.00553 * Math.log(1 - clampedM)) / 0.090165;
    phenoBioAge = Math.round(phenoBioAge);
  }

  // ═══════════════════════════════════════════════════════════════
  // PART 3 — METABOLIC AGE (waist + cholesterol ratio)
  // ═══════════════════════════════════════════════════════════════
  let metabolicAdj = 0;

  // Waist-to-Height Ratio
  const waist  = parseFloat(data.waist);
  const height = parseFloat(data.height);
  const whtr   = waist / height;
  if      (whtr < 0.40) metabolicAdj -= 6;
  else if (whtr < 0.50) metabolicAdj -= 2;
  else if (whtr < 0.55) metabolicAdj += 2;
  else if (whtr < 0.60) metabolicAdj += 5;
  else                  metabolicAdj += 10;

  // Cholesterol / HDL ratio (if both available, mg/dL)
  if (hasChol && hasHDL && hdl > 0) {
    const ratio = chol / hdl;
    if      (ratio < 3.0) metabolicAdj -= 3;
    else if (ratio < 3.5) metabolicAdj -= 2;
    else if (ratio <= 4.5) metabolicAdj += 0;
    else if (ratio <= 5.5) metabolicAdj += 3;
    else                   metabolicAdj += 6;
  }

  const metabolicAge = age + metabolicAdj;

  // ═══════════════════════════════════════════════════════════════
  // PART 4 — COMPOSITE BIO AGE
  // ═══════════════════════════════════════════════════════════════
  let bioAge;
  if (phenoBioAge !== null) {
    // PhenoAge available: blend with cardiovascular + metabolic
    bioAge = Math.round(phenoBioAge * 0.50 + cardioAge * 0.30 + metabolicAge * 0.20);
  } else {
    // No blood markers: cardio + metabolic only
    bioAge = Math.round(cardioAge * 0.55 + metabolicAge * 0.45);
  }

  // ═══════════════════════════════════════════════════════════════
  // SCORES (0–100, higher = biologically younger)
  // ═══════════════════════════════════════════════════════════════
  const cardioScore    = adjToScore(cardioAdj);
  const metabolicScore = adjToScore(metabolicAdj);
  const recoveryScore  = adjToScore(recoveryAdj);

  // PhenoAge score: how far from chronological age
  let phenoScore = 60;
  if (phenoBioAge !== null) {
    const diff = phenoBioAge - age;
    phenoScore = adjToScore(diff);
  }

  // ═══════════════════════════════════════════════════════════════
  // WHAT'S WORKING / WHAT TO IMPROVE
  // ═══════════════════════════════════════════════════════════════
  const working = [];
  const improve = [];

  if (rhr < 65)           working.push('goodHR');       else improve.push('improveHR');
  if (recoveryDrop >= 15) working.push('goodRecovery'); else improve.push('improveRecovery');
  if (whtr < 0.50)        working.push('goodWaist');    else improve.push('improveWaist');

  if (!isNaN(bp) && data.bloodPressure !== '') {
    if (bp < 130) working.push('goodBP'); else improve.push('improveBP');
  }
  if (hasGlucose) {
    if (glucose < 100) working.push('goodGlucose'); else improve.push('improveGlucose');
  }
  if (hasChol && hasHDL && hdl > 0) {
    if ((chol / hdl) < 4.0) working.push('goodCholesterol');
    else                     improve.push('improveCholesterol');
  }
  if (hasRDW) {
    if (rdw < 13.5) working.push('goodRDW'); else improve.push('improveRDW');
  }
  if (hasLymph) {
    if (lymph >= 20 && lymph <= 45) working.push('goodLymph'); else improve.push('improveLymph');
  }

  // ═══════════════════════════════════════════════════════════════
  // INSIGHT KEY
  // ═══════════════════════════════════════════════════════════════
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
    recoveryAge:  Math.round(age + recoveryAdj),
    phenoBioAge,
    cardioScore,
    metabolicScore,
    recoveryScore,
    phenoScore,
    working,
    improve,
    insightKey,
    hasBlood,
    bloodMarkersCount
  };
};

// Adjustment → score (0–100). adj=0 → 60, adj=-15 → ~97, adj=+20 → ~10
function adjToScore(adj) {
  return Math.max(5, Math.min(100, Math.round(60 - adj * 2.5)));
}
