import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyOverlay, localizeQuestion } from '../src/practice/overlay.js';
import { MISS_CAP, missCard, missedInOrder, pickNewMisses, readKept, writeKept } from '../src/practice/missCards.js';

const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const original = read('library/sets/quant/1.json');
const fixture = read('tests/fixtures/overlay/quant/1.json');

describe('the curated overlay loader', () => {
  const merged = applyOverlay(original, fixture);
  const byId = Object.fromEntries(merged.map((q) => [q.id, q]));

  it('lets overlay fields win and keeps absent ones', () => {
    const before = original.find((q) => q.id === 'quant-2');
    const q = byId['quant-2'];

    expect(q.question).toBe('Fixture question about ৳150');
    expect(q.options).toEqual(['1', '2', '3', '4', '5']);
    expect(q.answer).toBe(3);
    expect(q.explain).toBe('Fixture explanation.');
    expect(q.skill).toBe('line-segments');
    expect(q.difficulty).toBe(2);
    expect(q.topic).toBe(before.topic);
    expect(q.changes).toBeUndefined();
    expect(q.curated).toBe(true);
  });

  it('drops hidden items and leaves items without an entry untouched', () => {
    expect(byId['quant-3']).toBeUndefined();
    expect(merged).toHaveLength(original.length - 1);
    expect(byId['quant-1']).toBe(original.find((q) => q.id === 'quant-1'));
  });

  it('ignores fields that do not fit instead of breaking the set', () => {
    const before = original.find((q) => q.id === 'quant-4');

    expect(byId['quant-4'].options).toEqual(before.options);
    expect(byId['quant-4'].answer).toBe(before.answer);
    expect(byId['quant-4'].skill).toBe('logic-puzzles');
  });

  it('changes nothing without an overlay', () => {
    expect(applyOverlay(original, null)).toBe(original);
    expect(applyOverlay(original, {})).toBe(original);
  });

  it('shows Bangla with Bangla digits in Bangla, English otherwise', () => {
    const q = byId['quant-2'];
    const bn = localizeQuestion(q, 'bn');

    expect(localizeQuestion(q, 'en')).toBe(q);
    expect(bn.question).toBe('ফিক্সচার প্রশ্ন ১২');
    expect(bn.options).toEqual(['১', '২', '৩', '৪', '৫']);
    expect(bn.explain).toBe('ফিক্সচার ব্যাখ্যা ৩');
    expect(bn.answer).toBe(q.answer);
    expect(localizeQuestion(byId['quant-1'], 'bn')).toBe(byId['quant-1']);
  });
});

// curated-core.md section 3, item 6: a bad overlay must never ship silently.
describe('every overlay file in library/overlay', () => {
  const root = 'library/overlay';
  const files = existsSync(root)
    ? readdirSync(root).flatMap((collection) => readdirSync(join(root, collection)).map((file) => ({ collection, set: Number(file.replace(/\.json$/, '')), file: join(root, collection, file) })))
    : [];

  it('has files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const { collection, set, file } of files) {
    it(`${collection}/${set} fits its original set`, () => {
      const overlay = read(file);
      const sets = read(join('library/sets', collection, `${set}.json`));
      const byId = Object.fromEntries(sets.map((q) => [q.id, q]));

      expect(overlay.meta?.collection).toBe(collection);
      expect(overlay.meta?.set).toBe(set);

      for (const [id, item] of Object.entries(overlay.items)) {
        const where = `${file} ${id}`;
        const q = byId[id];

        expect(q, `${where}: id not in the original set`).toBeTruthy();
        expect(Object.keys(item).length, `${where}: empty item`).toBeGreaterThan(0);
        if (item.hidden) continue;

        if (item.options !== undefined) expect(item.options.length, `${where}: options length`).toBe(q.options.length);
        if (item.answer !== undefined) {
          expect(Number.isInteger(item.answer), `${where}: answer`).toBe(true);
          expect(item.answer >= 0 && item.answer < q.options.length, `${where}: answer out of range`).toBe(true);
        }
        if (item.bn?.options !== undefined) expect(item.bn.options.length, `${where}: bn.options length`).toBe(q.options.length);
        expect([1, 2, 3], `${where}: difficulty`).toContain(item.difficulty);
        expect(typeof item.skill === 'string' && item.skill.trim() !== '', `${where}: skill`).toBe(true);
        if (item.question !== undefined) expect(item.question, `${where}: LaTeX in question`).not.toMatch(/\$[^$]+\$/);
      }
    });
  }
});

describe('misses kept as cards', () => {
  const qs = [
    { id: 'a', question: 'Qa', options: ['1', '2', '3', '4'], answer: 0, explain: '' },
    { id: 'b', question: 'Qb', options: ['1', '2', '3', '4'], answer: 1, explain: 'because' },
    { id: 'c', question: 'Qc', options: ['1', '2', '3', '4'], answer: 2, explain: 'so' },
    { id: 'd', question: 'Qd', options: ['1', '2', '3', '4'], answer: 3 },
  ];
  const picked = { a: 1, b: 1, c: 0, d: 0 };

  it('takes the misses, explained ones first', () => {
    expect(missedInOrder(qs, picked).map((q) => q.id)).toEqual(['c', 'a', 'd']);
  });

  it('makes a due-now card with the explanation and a source id', () => {
    const card = missCard(qs[2], picked, { id: 'quant', title: 'Quantitative reasoning' });

    expect(card).toMatchObject({ sourceId: 'c', subject: 'Mathematics', question: 'Qc', correctAnswer: '3', yourAnswer: '1', explanation: 'so', nextReviewAt: null });
    expect(card.distractors).toEqual(['1', '2', '4']);
  });

  it('keeps the card in Bangla when the question was shown in Bangla', () => {
    const q = { ...qs[2], bn: { question: 'প্রশ্ন 2', explanation: 'কারণ' }, card: { question: 'en card', answer: 'x' } };
    const card = missCard(q, picked, { id: 'vocab' }, 'bn');

    expect(card.question).toBe('প্রশ্ন ২');
    expect(card.explanation).toBe('কারণ');
    expect(missCard(q, picked, { id: 'vocab' }, 'en').question).toBe('en card');
  });

  it('never keeps the same question twice and stops at the cap', () => {
    const cards = Array.from({ length: 15 }, (_, i) => ({ sourceId: `s${i}`, question: `Q${i}` }));

    expect(pickNewMisses(cards, {}, [])).toHaveLength(MISS_CAP);
    expect(pickNewMisses(cards.slice(0, 3), { s0: 'card-0' }, [{ id: 'card-0', question: 'Q0' }]).map((c) => c.sourceId)).toEqual(['s1', 's2']);
    // kept before but deleted since: it may come back
    expect(pickNewMisses(cards.slice(0, 1), { s0: 'card-0' }, [])).toHaveLength(1);
    // same text already a card (another device)
    expect(pickNewMisses(cards.slice(0, 2), {}, [{ id: 'x', question: 'Q1' }]).map((c) => c.sourceId)).toEqual(['s0']);
    expect(pickNewMisses([cards[0], cards[0]], {}, [])).toHaveLength(1);
  });

  it('remembers kept misses per account', () => {
    const mem = new Map();
    const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };

    writeKept('u1', { s1: 'c1', s2: 'c2' }, storage);
    writeKept('u1', { s1: null }, storage);
    expect(readKept('u1', storage)).toEqual({ s2: 'c2' });
    expect(readKept('u2', storage)).toEqual({});
  });
});
