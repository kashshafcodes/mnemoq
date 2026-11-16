import { describe, expect, it } from 'vitest';
import { missedAsCards } from '../src/diagnosticScore.js';
import { mistakesOf } from '../src/readiness.js';

// A SAT diagnostic as saved after the free /sat check: one multiple-choice
// miss and one typed-answer (student-produced response) miss with no options.
const satDiagnostic = {
  sections: [
    {
      id: 'math',
      name: 'Math',
      missed: [
        { id: 'm1', type: 'mcq', topic: 'Linear equations', question: 'If 2x + 3 = 11, x = ?', options: ['3', '4', '5', '6'], correct: 1, picked: 0, correctText: '4', pickedText: '3', explain: '2x = 8.' },
        { id: 'm2', type: 'spr', topic: 'Percentages', question: 'What is 20% of 50?', options: null, correct: null, picked: null, correctText: '10', pickedText: '12', explain: '' },
      ],
    },
  ],
};

// The compact copy kept on the account when the sign-up link is opened on another device.
const compactDiagnostic = { sections: [{ id: 'rw', name: 'Reading and Writing', missed: [{ id: 'r1', topic: 'Words in context', correct: 2, picked: 1 }] }] };

describe('turning diagnostic mistakes into cards', () => {
  it('handles SAT typed-answer questions without options (the blank exam path bug)', () => {
    const cards = missedAsCards(satDiagnostic);

    expect(cards).toHaveLength(2);
    expect(cards[1]).toMatchObject({ question: 'What is 20% of 50?', correctAnswer: '10', yourAnswer: '12', distractors: [] });
  });

  it('skips mistakes that have no question text', () => {
    expect(missedAsCards(compactDiagnostic)).toEqual([]);
    expect(mistakesOf(compactDiagnostic)).toEqual([]);
  });

  it('lists the same mistakes for the report', () => {
    expect(mistakesOf(satDiagnostic).map((m) => m.correctText)).toEqual(['4', '10']);
  });
});
