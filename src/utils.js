const REQUIRED_FIELDS = ["age", "smoker", "exercise", "diet"];


const YES = new Set(["yes", "y", "true", "t", "1", "✓", "✔"]);
const NO = new Set(["no", "n", "false", "f", "0", "✗", "✕"]);


const EXERCISE_MAP = new Map([
["never", "never"],
["rarely", "rarely"],
["seldom", "rarely"],
["sometimes", "sometimes"],
["occasional", "sometimes"],
["often", "sometimes"],
["daily", "daily"],
["regular", "daily"],
]);


const DIET_MAP = new Map([
["high sugar", "high sugar"],
["high-sugar", "high sugar"],
["processed", "processed"],
["high processed", "processed"],
["balanced", "balanced"],
["vegan", "balanced"],
["mediterranean", "balanced"],
]);


function clamp01(x) { return Math.max(0, Math.min(1, x)); }


module.exports = {
REQUIRED_FIELDS,
YES,
NO,
EXERCISE_MAP,
DIET_MAP,
clamp01,
};