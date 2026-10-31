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

// Minutes for each section, as set for the NSU paper.
export const NSU_TIMES = { english: 25, quant: 75, reading: 30, essay: 20 };

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
