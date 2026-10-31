// Pure helpers for mock tests: suggested settings, building a paper from the
// AI's questions and the student's own, and formatting the clock.

import { getPath } from './paths';

export const MOCK_SECTIONS = ['english', 'quant', 'reading'];
export const AI_MAX = { english: 8, quant: 8, reading: 4 };
export const MIN_PER_QUESTION = 1.2; // our suggestion, not an official figure
export const LETTERS = ['A', 'B', 'C', 'D', 'E'];

export const SOURCES = [
  { id: 'ai', label: 'AI-written', hint: 'Fresh questions, every answer key re-checked by a second AI pass.' },
  { id: 'mine', label: 'My questions', hint: 'Only questions from your own bank.' },
  { id: 'mixed', label: 'Mixed', hint: 'Your questions first, the AI fills the rest.' },
];

export function sectionName(pathId, id) {
  return getPath(pathId)?.subjects.find((s) => s.id === id)?.name || id;
}

export function bankCount(bank, sectionId) {
  return bank.filter((q) => q.sectionId === sectionId).length;
}

// Most questions a section can have with this source.
export function maxFor(sectionId, source, bank) {
  const mine = bankCount(bank, sectionId);

  if (source === 'mine') return mine;
  if (source === 'ai') return AI_MAX[sectionId] || 0;

  return mine + (AI_MAX[sectionId] || 0);
}

export const suggestMinutes = (questions) => Math.max(5, Math.ceil(questions * MIN_PER_QUESTION));

// choices: [{ id, count }]. Returns what the AI must write: section ids that
// still need questions after the student's own are used.
export function sectionsNeedingAi(choices, source, bank) {
  if (source === 'mine') return [];

  return choices
    .filter((c) => c.count > (source === 'ai' ? 0 : bankCount(bank, c.id)))
    .map((c) => c.id);
}

const shuffle = (list) => {
  const copy = [...list];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
};

// -> [{ id, name, passage, questions: [{ id, question, options, answer, topic, mine }] }]
export function assemblePaper(pathId, choices, source, bank, aiSections = []) {
  const paper = [];

  for (const choice of choices) {
    const ai = aiSections.find((s) => s.id === choice.id);
    const mine = source === 'ai' ? [] : shuffle(bank.filter((q) => q.sectionId === choice.id)).slice(0, choice.count);
    const fromAi = source === 'mine' || !ai ? [] : ai.questions.slice(0, choice.count - mine.length);
    const questions = [
      ...mine.map((q) => ({ question: q.question, options: q.options, answer: q.answer, topic: 'My questions', mine: true })),
      ...fromAi.map((q) => ({ question: q.question, options: q.options, answer: q.answer, topic: q.topic, mine: false })),
    ].map((q, i) => ({ ...q, id: `${choice.id}-${i + 1}` }));

    if (questions.length === 0) continue;

    paper.push({ id: choice.id, name: ai?.name || sectionName(pathId, choice.id), passage: fromAi.length > 0 ? ai?.passage || '' : '', questions });
  }

  return paper;
}

export function formatClock(totalSeconds) {
  const t = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');

  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
