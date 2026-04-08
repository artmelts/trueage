// TrueAge — Biological Age Calculator
// Method: Evidence-based biomarker scoring
// Sources: AHA guidelines, WHO standards, Levine 2018 PhenoAge reference ranges

window.TrueAge = window.TrueAge || {};

TrueAge.calculate = function(data) {
  const age = parseInt(data.age);

  // ═══════════════════════════════════════════════════════════════
  // PART 1 — CARDIOVASCULAR AGE
  // Two modes: A = home test (squats), B = workout data
  // ═══════════════════════════════════════════════════════════════
  let cardioAdj = 0;
  let recoveryAdj = 0;
  let rhr = NaN;
  let recoveryDrop = 0;

  if (data.cardioMode === 'workout') {
    // ── Mode B: Workout data ──────────────────────────────────────
    const avgHR      = parseFloat(data.workoutAvgHR);
    const maxHR      = parseFloat(data.workoutMaxHR);
    const duration   = parseFloat(data.workoutDuration);

    // Theoretical max HR for age (Tanaka formula, more accurate than 220-age)
    const theoMax = 208 - (0.7 * age);

    // Max HR achieved as % of theoretical max
    const maxPct = maxHR / theoMax;
    if      (maxPct > 1.05) cardioAdj -= 8;  // elite — exceeds theoretical
    else if (maxPct > 0.95) cardioAdj -= 5;
    else if (maxPct > 0.88) cardioAdj -= 2;
    else if (maxPct > 0.80) cardioAdj += 1;
    else                    cardioAdj += 4;

    // Avg HR as % of max — indicates sustained intensity
    const avgPct = avgHR / maxHR;
    if      (avgPct > 0.88) cardioAdj -= 4;  // very high sustained intensity
    else if (avgPct > 0.80) cardioAdj -= 2;
    else if (avgPct > 0.70) cardioAdj += 0;
    else                    cardioAdj += 2;

    // Duration bonus — sustained effort
    if      (duration >= 50) cardioAdj -= 3;
    else if (duration >= 30) cardioAdj -= 1;
    else if (duration >= 20) cardioAdj += 0;
    else                     cardioAdj += 2;

    recoveryAdj = 0; // not measured in workout mode

  } else {
    // ── Mode A: Home test (30 squats) ────────────────────────────
    rhr = parseFloat(data.restingHR);
    if      (rhr < 50)  cardioAdj -= 7;
    else if (rhr < 60)  cardioAdj -= 4;
    else if (rhr < 70)  cardioAdj -= 1;
    else if (rhr <= 80) cardioAdj += 2;
    else if (rhr <= 90) cardioAdj += 5;
    else                cardioAdj += 9;

    const hrAfter    = parseFloat(data.exerciseHR);
    const hrRecovery = parseFloat(data.recoveryHR);
    recoveryDrop = hrAfter - hrRecovery;
    if      (recoveryDrop > 25)  recoveryAdj = -4;
    else if (recoveryDrop >= 15) recoveryAdj = -1;
    else if (recoveryDrop >= 10) recoveryAdj =  2;
    else                         recoveryAdj =  6;
    cardioAdj += recoveryAdj;
  }

  let bpAdj = 0;
  const bp = parseFloat(data.bloodPressure);
  if (!isNaN(bp) && data.bloodPressure !== '') {
    if      (bp < 110) bpAdj = -4;
    else if (bp < 120) bpAdj = -2;
    else if (bp < 130) bpAdj =  0;
    else if (bp < 140) bpAdj =  3;
    else               bpAdj =  8;
    cardioAdj += bpAdj;
  }

  const cardioAge = age + cardioAdj;

  // ═══════════════════════════════════════════════════════════════
  // PART 2 — METABOLIC AGE (body composition)
  // ═══════════════════════════════════════════════════════════════
  let metabolicAdj = 0;

  const waist  = parseFloat(data.waist);
  const height = parseFloat(data.height);
  const whtr   = waist / height;

  // Athletes have more muscle mass around the core — shift thresholds up by 0.03
  const isAthlete = data.cardioMode === 'workout';
  const whtrOffset = isAthlete ? 0.03 : 0;
  if      (whtr < 0.42 + whtrOffset) metabolicAdj -= 5;
  else if (whtr < 0.50 + whtrOffset) metabolicAdj -= 2;
  else if (whtr < 0.55 + whtrOffset) metabolicAdj += 2;
  else if (whtr < 0.60 + whtrOffset) metabolicAdj += 6;
  else                                metabolicAdj += 11;

  const metabolicAge = age + metabolicAdj;

  // ═══════════════════════════════════════════════════════════════
  // PART 3 — BLOOD BIOMARKER SCORE
  // Each biomarker contributes ± years based on validated reference ranges
  // Sources: PhenoAge (Levine 2018), AHA, WHO lab reference ranges
  // ═══════════════════════════════════════════════════════════════
  let bloodAdj = 0;
  let bloodMarkersCount = 0;

  // — Albumin (g/dL): marker of nutrition, liver function, inflammation
  const albumin = parseFloat(data.albumin);
  if (!isNaN(albumin) && data.albumin !== '') {
    bloodMarkersCount++;
    if      (albumin >= 4.5)              bloodAdj -= 3;
    else if (albumin >= 4.0)              bloodAdj -= 1;
    else if (albumin >= 3.5)              bloodAdj += 3;
    else                                  bloodAdj += 8;
  }

  // — Glucose (mg/dL): metabolic health
  const glucose = parseFloat(data.glucose);
  if (!isNaN(glucose) && data.glucose !== '') {
    bloodMarkersCount++;
    if      (glucose < 80)                bloodAdj -= 3;
    else if (glucose < 90)                bloodAdj -= 1;
    else if (glucose < 100)               bloodAdj += 0;
    else if (glucose < 110)               bloodAdj += 3;
    else if (glucose < 126)               bloodAdj += 6;
    else                                  bloodAdj += 11;
  }

  // — Creatinine (mg/dL): kidney function
  const creat = parseFloat(data.creatinine);
  if (!isNaN(creat) && data.creatinine !== '') {
    bloodMarkersCount++;
    const isMale = data.gender === 'male';
    if (isMale) {
      if      (creat >= 0.7 && creat <= 1.1) bloodAdj -= 1;
      else if (creat < 1.3)                  bloodAdj += 2;
      else                                   bloodAdj += 5;
    } else {
      if      (creat >= 0.5 && creat <= 0.9) bloodAdj -= 1;
      else if (creat < 1.1)                  bloodAdj += 2;
      else                                   bloodAdj += 5;
    }
  }

  // — Alkaline Phosphatase (U/L): liver/bone aging marker
  const alkphos = parseFloat(data.alkphos);
  if (!isNaN(alkphos) && data.alkphos !== '') {
    bloodMarkersCount++;
    if      (alkphos < 60)                bloodAdj -= 2;
    else if (alkphos <= 100)              bloodAdj += 0;
    else if (alkphos <= 150)              bloodAdj += 3;
    else                                  bloodAdj += 6;
  }

  // — Lymphocytes % (LYM%): immune aging
  const lymph = parseFloat(data.lymphocytes);
  if (!isNaN(lymph) && data.lymphocytes !== '') {
    bloodMarkersCount++;
    if      (lymph >= 25 && lymph <= 40)  bloodAdj -= 2;
    else if (lymph >= 20 && lymph < 25)   bloodAdj += 0;
    else if (lymph > 40  && lymph <= 45)  bloodAdj += 0;
    else                                  bloodAdj += 4;
  }

  // — WBC (K/ul): systemic inflammation
  const wbc = parseFloat(data.wbc);
  if (!isNaN(wbc) && data.wbc !== '') {
    bloodMarkersCount++;
    if      (wbc < 4.5)                   bloodAdj -= 3;
    else if (wbc < 6.0)                   bloodAdj -= 1;
    else if (wbc <= 8.0)                  bloodAdj += 1;
    else if (wbc <= 10.0)                 bloodAdj += 4;
    else                                  bloodAdj += 7;
  }

  // — MCV (fL): red cell size, B12/folate status
  const mcv = parseFloat(data.mcv);
  if (!isNaN(mcv) && data.mcv !== '') {
    bloodMarkersCount++;
    if      (mcv >= 82 && mcv <= 94)      bloodAdj -= 2;
    else if (mcv > 94  && mcv <= 100)     bloodAdj += 0;
    else if (mcv > 100 && mcv <= 110)     bloodAdj += 2;
    else if (mcv < 80)                    bloodAdj += 3;
    else                                  bloodAdj += 5;
  }

  // — RDW (%): red cell size variability — strong mortality predictor
  const rdw = parseFloat(data.rdw);
  if (!isNaN(rdw) && data.rdw !== '') {
    bloodMarkersCount++;
    if      (rdw < 12.0)                  bloodAdj -= 4;
    else if (rdw < 13.0)                  bloodAdj -= 2;
    else if (rdw < 13.5)                  bloodAdj += 0;
    else if (rdw < 14.5)                  bloodAdj += 3;
    else                                  bloodAdj += 6;
  }

  // — Cholesterol / HDL ratio: cardiovascular risk
  const chol = parseFloat(data.cholesterol);
  const hdl  = parseFloat(data.hdl);
  if (!isNaN(chol) && !isNaN(hdl) && hdl > 0 && data.cholesterol !== '' && data.hdl !== '') {
    bloodMarkersCount++;
    const ratio = chol / hdl;
    if      (ratio < 2.5)                 bloodAdj -= 4;
    else if (ratio < 3.0)                 bloodAdj -= 2;
    else if (ratio < 3.5)                 bloodAdj -= 1;
    else if (ratio <= 4.5)                bloodAdj += 0;
    else if (ratio <= 5.5)                bloodAdj += 3;
    else                                  bloodAdj += 7;
  }

  const hasBlood = bloodMarkersCount >= 2;
  const bloodAge = hasBlood ? age + bloodAdj : null;

  // ═══════════════════════════════════════════════════════════════
  // PART 4 — COMPOSITE BIO AGE
  // Weights depend on how many data sources are available
  // ═══════════════════════════════════════════════════════════════
  let bioAge;
  if (hasBlood) {
    bioAge = Math.round(
      cardioAge    * 0.35 +
      metabolicAge * 0.20 +
      bloodAge     * 0.45
    );
  } else {
    bioAge = Math.round(cardioAge * 0.55 + metabolicAge * 0.45);
  }

  // Safety clamp: result should be plausible (age ± 25 years)
  bioAge = Math.max(age - 20, Math.min(age + 20, bioAge));

  // ═══════════════════════════════════════════════════════════════
  // SCORES (0–100, higher = biologically younger)
  // ═══════════════════════════════════════════════════════════════
  const cardioScore    = adjToScore(cardioAdj);
  const metabolicScore = adjToScore(metabolicAdj);
  const bloodScore     = hasBlood ? adjToScore(bloodAdj) : null;

  // ═══════════════════════════════════════════════════════════════
  // WHAT'S WORKING / WHAT TO IMPROVE
  // ═══════════════════════════════════════════════════════════════
  const working = [];
  const improve = [];

  if (data.cardioMode === 'workout') {
    working.push('goodHR'); // workout mode implies active cardiovascular fitness
  } else {
    if (!isNaN(rhr) && rhr < 65) working.push('goodHR'); else improve.push('improveHR');
    if (recoveryDrop >= 15) working.push('goodRecovery'); else improve.push('improveRecovery');
  }
  const whtrThreshold = isAthlete ? 0.53 : 0.50;
  if (whtr < whtrThreshold) working.push('goodWaist'); else improve.push('improveWaist');
  if (!isNaN(bp) && data.bloodPressure !== '') {
    if (bp < 130) working.push('goodBP'); else improve.push('improveBP');
  }
  if (!isNaN(glucose) && data.glucose !== '') {
    if (glucose < 90) working.push('goodGlucose'); else improve.push('improveGlucose');
  }
  if (!isNaN(chol) && !isNaN(hdl) && hdl > 0 && data.cholesterol !== '' && data.hdl !== '') {
    if ((chol/hdl) < 3.5) working.push('goodCholesterol'); else improve.push('improveCholesterol');
  }
  if (!isNaN(rdw) && data.rdw !== '') {
    if (rdw < 13.0) working.push('goodRDW'); else improve.push('improveRDW');
  }
  if (!isNaN(wbc) && data.wbc !== '') {
    if (wbc < 6.0) working.push('goodWBC'); else improve.push('improveWBC');
  }

  // ═══════════════════════════════════════════════════════════════
  // INSIGHT KEY
  // ═══════════════════════════════════════════════════════════════
  const diff = bioAge - age;
  let insightKey;
  if      (diff <= -5) insightKey = 'veryYoung';
  else if (diff <  -1) insightKey = 'slightlyYoung';
  else if (diff <=  1) insightKey = 'onTarget';
  else if (diff <=  4) insightKey = 'slightlyOld';
  else                 insightKey = 'veryOld';

  return {
    bioAge,
    chronoAge: age,
    diff,
    cardioAge:    Math.round(cardioAge),
    metabolicAge: Math.round(metabolicAge),
    bloodAge:     bloodAge !== null ? Math.round(bloodAge) : null,
    recoveryAge:  Math.round(age + recoveryAdj),
    cardioScore,
    metabolicScore,
    bloodScore:   bloodScore !== null ? bloodScore : 60,
    working,
    improve,
    insightKey,
    hasBlood,
    bloodMarkersCount
  };
};

function adjToScore(adj) {
  return Math.max(5, Math.min(98, Math.round(60 - adj * 2.8)));
}
