// The curated-core overlay (company/product/curated-core.md, section 3).
//
// library/overlay/<collection>/<set>.json holds corrections, explanations,
// Bangla, a skill tag and a difficulty for questions of the original set,
// keyed by question id. The server (api/library.js) joins it at load time;
// the app picks the language to show with localizeQuestion().
//
// Plain JavaScript with no imports, so the serverless API can load it too.

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const bnDigits = (text) => String(text).replace(/\d/g, (d) => BN_DIGITS[d]);

const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isTextList = (value, length) => Array.isArray(value) && value.length === length && value.every(isText);

// questions = the original set; overlay = the parsed overlay file or null.
// For every field the overlay has, the overlay wins; absent fields keep the
// original. `hidden: true` drops the item. Fields that do not fit (options of
// another length, an answer out of range) are ignored rather than trusted, so
// a bad overlay can never break a set. tests/overlay.test.js fails on them.
export function applyOverlay(questions, overlay) {
  const items = overlay && typeof overlay.items === 'object' && overlay.items ? overlay.items : null;

  if (!items || !Array.isArray(questions)) return questions;

  const out = [];

  for (const original of questions) {
    const item = Object.prototype.hasOwnProperty.call(items, original.id) ? items[original.id] : null;

    if (!item || typeof item !== 'object') {
      out.push(original);
      continue;
    }

    if (item.hidden === true) continue;

    const q = { ...original, curated: true };
    const size = original.options.length;

    if (isText(item.question)) q.question = item.question;
    if (isTextList(item.options, size)) q.options = item.options;
    if (Number.isInteger(item.answer) && item.answer >= 0 && item.answer < size) q.answer = item.answer;
    if (isText(item.explanation)) q.explain = item.explanation;
    if (isText(item.skill)) q.skill = item.skill;
    if ([1, 2, 3].includes(item.difficulty)) q.difficulty = item.difficulty;
    if (item.card && isText(item.card.question) && isText(item.card.answer)) q.card = { question: item.card.question, answer: item.card.answer };

    if (item.bn && typeof item.bn === 'object') {
      const bn = {};

      if (isText(item.bn.question)) bn.question = item.bn.question;
      if (isTextList(item.bn.options, size)) bn.options = item.bn.options;
      if (isText(item.bn.explanation)) bn.explanation = item.bn.explanation;
      if (Object.keys(bn).length > 0) q.bn = bn;
    }

    out.push(q);
  }

  return out;
}

// What the app shows for one question in the current language. In Bangla an
// overlaid question uses its `bn` fields where they exist (English options
// when `bn.options` is missing, as for purely numeric options) with Bangla
// digits, like the rest of the Bangla app. Without `bn`, English is shown.
export function localizeQuestion(q, lang) {
  if (lang !== 'bn' || !q?.bn) return q;

  return {
    ...q,
    question: bnDigits(q.bn.question || q.question),
    options: (q.bn.options || q.options).map(bnDigits),
    explain: q.bn.explanation ? bnDigits(q.bn.explanation) : q.explain,
  };
}
