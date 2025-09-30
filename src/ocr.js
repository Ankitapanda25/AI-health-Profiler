const Tesseract = require('tesseract.js');
const { levenshtein } = require("./pipeline");

async function ocrImageToText(imageBuffer) {
  try {
    console.log("[ocrImageToText] received buffer size:", imageBuffer.length);
    const { data } = await Tesseract.recognize(imageBuffer, 'eng', {
      logger: m => console.log("[tesseract]", m) // progress logs
    });
    console.log("[ocrImageToText] OCR done, length:", data.text.length);
    return data.text || '';
  } catch (err) {
    console.error("[ocrImageToText] ERROR:", err);
    const e = new Error("ocr_processing_failed");
    e.code = "ocr_processing_failed";
    throw e;
  }
}


function kvFromOcrText(rawText) {
const pairs = {};

  // 1) Normalize separators & whitespace (keep values untouched)
  const text = String(rawText || "")
    .replace(/[\u2012-\u2015]/g, ":")  // en/em dashes → ':'
    .replace(/\uFF1A/g, ":")           // fullwidth colon → ':'
    .replace(/[=]/g, ":")              // equal sign → ':'
    .replace(/\r/g, "");
  const lines = text.split(/\n+/);

  console.log("[kvFromOcrText] cleaned lines:", lines);

  // 2) Fuzzy key canon
  const KEYS = ["age", "smoker", "exercise", "diet"];
  const toCanonKey = (kRaw) => {
    const s = String(kRaw).toLowerCase().replace(/[^a-z]/g, "").trim();
    if (!s) return null;

    // quick heuristics first
    if (s.startsWith("age")) return "age";
    if (s.startsWith("smok")) return "smoker";
    if (s.startsWith("exercis")) return "exercise";
    if (s.startsWith("diet")) return "diet";

    // fuzzy fallback
    let best = null, bestD = Infinity;
    for (const cand of KEYS) {
      const d = levenshtein(s, cand);
      if (d < bestD) { bestD = d; best = cand; }
    }
    return (bestD <= 2) ? best : null; // tolerate small OCR typos (e.g., "exercize")
  };

  // 3) Parse lines with flexible "Key : Value"
  for (const line of lines) {
    const L = line.trim();
    if (!L) continue;

    const m = L.match(/^\s*([A-Za-z ]{2,})\s*:\s*(.+?)\s*$/);
    if (!m) { console.log("[kv] no match:", L); continue; }

    const keyRaw = m[1];
    const valRaw = m[2]; // leave value untouched; pipeline will normalize
    const key = toCanonKey(keyRaw);

    if (!key) { console.log("[kv] unknown key:", keyRaw); continue; }

    pairs[key] = String(valRaw).trim();
    console.log("[kv] set:", key, "=>", pairs[key]);
  }

  console.log("[kvFromOcrText] final pairs:", pairs);
  return pairs;
}


module.exports = { ocrImageToText, kvFromOcrText };
