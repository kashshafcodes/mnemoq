// Marking SAT answers: multiple choice and typed-in ("student-produced") answers.
// Pure functions, so they are easy to test.

import { SECTIONS, SKILLS } from './blueprint';

// "3/4", "-1.5", ".75", "12" -> number, or null when it is not a number.
export function parseTyped(raw) {
  const text = String(raw ?? '').trim().replace(/\s+/g, '').replace(/−/g, '-');

  if (!text) return null;

  const fraction = text.match(/^(-?\d+)\/(\d+)$/);

  if (fraction) {
    const bottom = Number(fraction[2]);

    return bottom === 0 ? null : Number(fraction[1]) / bottom;
  }

  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(text)) return null;

  return Number(text);
}

// A typed answer is right when it equals an accepted value. A long decimal may
// be rounded or cut short, as on the real test, but must keep at least three
// decimal places (0.666 and 0.667 both count for 2/3; 0.66 and 0.7 do not).
export function typedIsCorrect(raw, values = []) {
  const typed = parseTyped(raw);

  if (typed === null) return false;

  const text = String(raw).trim();
  const decimals = text.includes('/') ? null : (text.split('.')[1] || '').length;

  return values.some((value) => {
    if (Math.abs(typed - value) < 1e-9) return true;
    if (decimals === null || decimals < 3) return false;

    const scale = 10 ** decimals;
    const rounded = Math.round(value * scale) / scale;
    const cut = Math.trunc(value * scale) / scale;

    return Math.abs(typed - rounded) < 1e-9 || Math.abs(typed - cut) < 1e-9;
  });
}

export function isAnswered(item, answer) {
  return item.type === 'spr' ? parseTyped(answer) !== null : Number.isInteger(answer);
}

export function isCorrect(item, answer) {
  if (item.type === 'spr') return typedIsCorrect(answer, item.values);

  return Number.isInteger(answer) && answer === item.answer;
}

export const correctText = (item) => (item.type === 'spr' ? item.accept[0] : item.options[item.answer]);

// One section's result, in the shape saved with every diagnostic and test.
//   items:   questions of a single section, in the order they were shown
//   answers: { [itemId]: optionIndex | typed text }
export function scoreItems(sectionId, items, answers, extra = {}) {
  const topics = new Map();
  const levels = { 1: [0, 0], 2: [0, 0], 3: [0, 0] };
  const missed = [];
  let correct = 0;

  for (const item of items) {
    const answer = answers[item.id];
    const right = isCorrect(item, answer);
    const topic = topics.get(item.skill) || { topic: SKILLS[item.skill]?.name || item.skill, skill: item.skill, domain: item.domain, correct: 0, total: 0 };

    topic.total += 1;
    levels[item.level][1] += 1;

    if (right) {
      topic.correct += 1;
      levels[item.level][0] += 1;
      correct += 1;
    } else {
      const answered = isAnswered(item, answer);

      missed.push({
        id: item.id,
        type: item.type,
        skill: item.skill,
        topic: topic.topic,
        level: item.level,
        passage: item.passage || '',
        table: item.table || null,
        question: item.question,
        options: item.options || null,
        correct: item.type === 'spr' ? null : item.answer,
        picked: item.type === 'spr' || !answered ? null : answer,
        correctText: correctText(item),
        pickedText: !answered ? '' : item.type === 'spr' ? String(answer).trim() : item.options[answer],
        explain: item.explain || '',
      });
    }

    topics.set(item.skill, topic);
  }

  return {
    id: sectionId,
    name: SECTIONS[sectionId].name,
    correct,
    total: items.length,
    topics: [...topics.values()],
    levels,
    missed,
    ids: items.map((item) => item.id),
    ...extra,
  };
}

const tableAsText = (table) =>
  table ? `\n${[table.head, ...table.rows].map((row) => row.join(' | ')).join('\n')}` : '';

// Missed questions as flashcards. The passage travels with the question, so
// the card makes sense on its own.
export function missedAsCards(sections = []) {
  const cards = [];

  for (const section of sections) {
    const subject = SECTIONS[section.id]?.cardSubject;

    if (!subject) continue;

    for (const m of section.missed || []) {
      const stem = [m.passage, m.passage || m.table ? '' : null, m.question].filter((part) => part !== null && part !== '').join('\n\n');

      cards.push({
        subject,
        sectionId: section.id,
        topic: m.topic,
        question: `${stem}${tableAsText(m.table)}`.slice(0, 1900),
        correctAnswer: m.correctText,
        yourAnswer: m.pickedText || '',
        distractors: m.options ? m.options.filter((_, i) => i !== m.correct) : [],
        explain: m.explain || '',
      });
    }
  }

  return cards;
}
