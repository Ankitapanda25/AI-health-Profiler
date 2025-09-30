
const { REQUIRED_FIELDS, YES, NO, EXERCISE_MAP, DIET_MAP, clamp01 } = require('./utils');

function cleanAlpha(v) {
  return String(v || '')
    .toLowerCase()
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Classic Levenshtein distance */
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,                    
        dp[j - 1] + 1,               
        prev + (a[i - 1] === b[j - 1] ? 0 : 1) 
      );
      prev = tmp;
    }
    }
    console.log("ldistance", dp[n])
  return dp[n];
}

function bestFuzzyLabel(raw, candidates, threshold = 0.7) {
  const s = cleanAlpha(raw).replace(/ /g, '');
  if (!s) return null;

  let best = null;
  let bestScore = -Infinity;

  for (const cand of candidates) {
    const t = cand.toLowerCase().replace(/ /g, '');
    const dist = levenshtein(s, t);
    const maxLen = Math.max(s.length, t.length) || 1;
    const score = 1 - dist / maxLen; 
    if (score > bestScore) { bestScore = score; best = cand; }
  }

  return bestScore >= threshold ? best : null;
}


const EXERCISE_CANON = ['never', 'rarely', 'sometimes', 'daily'];
const DIET_CANON     = ['high sugar', 'processed', 'balanced'];

/* --------------- normalizers --------------- */

function normBool(v) {
  const s = String(v).trim().toLowerCase();
  if (YES.has(s)) return { val: true, conf: 0.98 };
  if (NO.has(s)) return { val: false, conf: 0.98 };

  const tokens = s.split(/\s+/);
  if (tokens.some(t => YES.has(t))) return { val: true, conf: 0.9 };
  if (tokens.some(t => NO.has(t))) return { val: false, conf: 0.9 };

  return { val: null, conf: 0.5 };
}

function normExercise(v) {
  let s0 = String(v).trim().toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ');
 
  for (const [k, mapped] of EXERCISE_MAP) {
    if (s0.includes(k)) return { val: mapped, conf: 0.9 };
  }

  const fz = bestFuzzyLabel(s0, EXERCISE_CANON, 0.7);
  if (fz) return { val: fz, conf: 0.8 };
}

function normDiet(v) {
  let s0 = String(v).trim().toLowerCase().replace(/[^a-z ]/g, '');

  for (const [k, mapped] of DIET_MAP) {
    if (s0.includes(k)) return { val: mapped, conf: 0.9 };
  }
  // 2) new: space-insensitive fuzzy to canonical labels
  const fz = bestFuzzyLabel(s0, DIET_CANON, 0.7);
  if (fz) return { val: fz, conf: 0.8 };
  console.log("normDiet", cleanAlpha(s0))
  return { val: cleanAlpha(s0) || null, conf: 0.6 };
}


function normalizeKv(raw = {}) {
  const answers = {};
  const missing = [];
  const fieldConfs = [];

  for (const f of REQUIRED_FIELDS) {
    if (!(f in raw) || raw[f] === null || raw[f] === '') { missing.push(f); continue; }
    const v = raw[f];

    if (f === 'age') {
      const age = Number.parseInt(String(v).match(/\d{1,3}/)?.[0] ?? v, 10);
      if (Number.isFinite(age) && age >= 0 && age <= 120) {
          answers.age = age; fieldConfs.push(0.95);
          
      } else {
        missing.push(f);
      }
    }
    if (f === 'smoker') {
        const { val, conf } = normBool(v);
        console.log("normBool(v)", val)
      if (val === null) { missing.push(f); } else { answers.smoker = val; fieldConfs.push(conf); }
    }
    if (f === 'exercise') {
        const { val, conf } = normExercise(v);
        console.log("normExercise(v)", val)
      if (!val) { missing.push(f); } else { answers.exercise = val; fieldConfs.push(conf); }
    }
    if (f === 'diet') {
        const { val, conf } = normDiet(v);
        console.log("normDiet(v)", val)
      if (!val) { missing.push(f); } else { answers.diet = val; fieldConfs.push(conf); }
    }
  }

  const penalty = 0.1 * missing.length;
  const base = fieldConfs.length ? (fieldConfs.reduce((a,b)=>a+b,0)/fieldConfs.length) : 0;
  const confidence = clamp01(base - penalty);

  return { answers, missing_fields: missing, confidence: Number(confidence.toFixed(2)) };
}

function parseFromTextOrOcr({ textJson, ocrKv }) {
  const src = textJson || ocrKv || {};
  const parsed = normalizeKv(src);
  if (parsed.missing_fields.length > (REQUIRED_FIELDS.length / 2)) {
    return { status: 'incomplete_profile', reason: '>50% fields missing' };
  }
  return parsed;
}


function extractFactors(answers) {
  const factors = [];
  const confs = [];

  if (answers.smoker === true) { factors.push('smoking'); confs.push(0.95); }

  const ex = answers.exercise;
  if (ex === 'never' || ex === 'rarely') { factors.push('low exercise'); confs.push(0.9); }
  else if (ex === 'sometimes') { factors.push('suboptimal activity'); confs.push(0.75); }

  const d = answers.diet;
  if (d === 'high sugar' || d === 'processed') { factors.push('poor diet'); confs.push(0.9); }

  const confidence = confs.length ? (confs.reduce((a,b)=>a+b,0)/confs.length) : 0.7;
  return { factors, confidence: Number(confidence.toFixed(2)) };
}


function scoreAndClassify(answers) {
  let score = 0;
  const rationale = [];

  if (answers.smoker === true) { score += 40; rationale.push('smoking'); }

  const ex = answers.exercise;
  if (ex === 'never' || ex === 'rarely') { score += 20; rationale.push('low activity'); }
  else if (ex === 'sometimes') { score += 10; rationale.push('insufficient activity'); }

  const d = answers.diet;
  if (d === 'high sugar') { score += 20; rationale.push('high sugar diet'); }
  else if (d === 'processed') { score += 15; rationale.push('processed diet'); }

  const age = answers.age;
  if (Number.isInteger(age)) {
    if (age >= 65) { score += 16; rationale.push('age 65+'); }
    else if (age >= 55) { score += 12; rationale.push('age 55–64'); }
    else if (age >= 40) { score += 8; rationale.push('age 40–54'); }
  }

  for (const f of REQUIRED_FIELDS) {
    if (!(f in answers)) { score += 5; rationale.push(`unknown ${f}`); }
  }

  const risk_level = (score < 30) ? 'low' : (score < 60) ? 'moderate' : 'high';
  return { risk_level, score: Math.trunc(score), rationale };
}

function recommend(risk_level, factors) {
  const recommendations = [];

  if (factors.includes('smoking')) {
    recommendations.push('Start a quit plan; set a quit date within 2 weeks; consider nicotine replacement or counseling.');
  }
  if (factors.includes('poor diet')) {
    recommendations.push('Reduce added sugar to <25g/day; replace sugary drinks with water; add 2 fruit + 3 veg servings daily.');
  }
  if (factors.includes('low exercise') || factors.includes('suboptimal activity')) {
    recommendations.push('Walk ~30 minutes daily, 5 days/week; include 2 light strength sessions.');
  }

  if (risk_level === 'high') {
    recommendations.push('Consider booking a routine health check with a clinician in the next 1–2 months (non-urgent).');
  } else if (risk_level === 'moderate') {
    recommendations.push('Track daily steps and sugar intake for 2 weeks and review progress.');
  }

  if (recommendations.length === 0) {
    recommendations.push('Maintain current habits; review in ~6 months.');
  }

  return { risk_level, factors, recommendations, status: 'ok' };
}


function profileFromInput({ textJson, ocrKv }) {
  const parsed = parseFromTextOrOcr({ textJson, ocrKv });
  if (parsed.status === 'incomplete_profile') return parsed;

  const { answers } = parsed;
  const fx = extractFactors(answers);
  const risk = scoreAndClassify(answers);
  const recs = recommend(risk.risk_level, fx.factors);

  return { parsed, factors: fx, risk, recommendations: recs };
}

module.exports = {
  normalizeKv,
  parseFromTextOrOcr,
  extractFactors,
  scoreAndClassify,
  recommend,
  profileFromInput,
};
