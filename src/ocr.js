const Tesseract = require('tesseract.js');

async function ocrImageToText(imageBuffer) {
const { data } = await Tesseract.recognize(imageBuffer, 'eng');
return (data && data.text) ? data.text : '';
}


function kvFromOcrText(rawText) {
const pairs = {};
const lines = String(rawText || '').split(/\r?\n/);
for (const line of lines) {
const m = line.match(/\s*([A-Za-z ]+)\s*:\s*(.+)\s*$/);
if (!m) continue;
const key = m[1].trim().toLowerCase();
const value = m[2].trim();
if (key === 'age') pairs.age = value;
if (key === 'smoker') pairs.smoker = value;
if (key === 'exercise') pairs.exercise = value;
if (key === 'diet') pairs.diet = value;
}
return pairs;
}


module.exports = { ocrImageToText, kvFromOcrText };