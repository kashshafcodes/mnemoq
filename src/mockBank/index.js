// Prepared mock tests, by exam path. Every question here is original.
//
// Want to add your own licensed question sets (for example papers you have
// written permission to publish)? Put them in extra.js, in the same shape.
// See README.md in this folder.

import { EXTRA_MOCKS } from './extra.js';
import { NSU_ENGLISH } from './nsuEnglish.js';
import { NSU_ESSAY } from './nsuEssay.js';
import { NSU_QUANT } from './nsuQuant.js';
import { NSU_READING } from './nsuReading.js';
import { BRAC_MATH } from './bracMath.js';
import { BRAC_HMPHYS } from './bracHmphys.js';

// Minutes for each section, as set for the NSU paper.
export const NSU_TIMES = { english: 25, quant: 75, reading: 30, essay: 20 };

// BRAC's paper has four options (A to D). Its English sets reuse the original
// English questions above, keeping the answer and the first three wrong options.
function fourOptions(q) {
  const keep = [q.answer, ...q.options.map((_, i) => i).filter((i) => i !== q.answer).slice(0, 3)].sort((a, b) => a - b);

  return { ...q, id: `brac-${q.id}`, options: keep.map((i) => q.options[i]), answer: keep.indexOf(q.answer) };
}

// Minutes per section. BRAC publishes only the total (1 h 50 min for sections
// A to D), so this split is our estimate.
export const BRAC_TIMES = { english: 20, essay: 40, bmath: 30, hmphys: 20 };

const PREPARED = {
  nsu: {
    times: NSU_TIMES,
    sections: {
      english: NSU_ENGLISH.map((m) => ({ ...m, title: `English Mock ${m.n}` })),
      quant: NSU_QUANT.map((m) => ({ ...m, title: `Math Mock ${m.n}` })),
      reading: NSU_READING.map((m) => ({ ...m, title: `Reading Mock ${m.n}` })),
      essay: NSU_ESSAY.map((m) => ({ ...m, title: `Essay Mock ${m.n}` })),
    },
  },
  brac: {
    times: BRAC_TIMES,
    sections: {
      english: NSU_ENGLISH.map((m) => ({ n: m.n, title: `English Mock ${m.n}`, questions: m.questions.slice(0, 20).map(fourOptions) })),
      bmath: BRAC_MATH.map((m) => ({ ...m, title: `Mathematics Mock ${m.n}` })),
      hmphys: BRAC_HMPHYS.map((m) => ({ ...m, title: `Higher Math & Physics Mock ${m.n}` })),
      essay: NSU_ESSAY.map((m) => ({ ...m, title: `Composition ${m.n}` })),
    },
  },
};

// Adds the student-supplied sets after the built-in ones.
for (const extra of EXTRA_MOCKS) {
  const target = PREPARED[extra.pathId]?.sections[extra.sectionId];

  if (!target || !Array.isArray(extra.mocks)) continue;

  extra.mocks.forEach((m, i) => target.push({ ...m, n: target.length + 1, title: m.title || `${extra.sectionId} Mock ${target.length + 1}` }));
}

export function preparedFor(pathId) {
  return PREPARED[pathId] || null;
}

// Stable key for a prepared mock, stored with the result.
export const mockKey = (sectionId, n) => `prepared:${sectionId}:${n}`;
