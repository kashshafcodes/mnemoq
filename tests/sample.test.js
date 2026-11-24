import { describe, expect, it } from 'vitest';
import { CARD_HOME, QUESTIONS } from '../src/daily/questions.js';
import { SAMPLE_QUESTIONS, SAMPLE_RAW } from '../src/sample/questions.js';
import { SAMPLE, resultKeys, shareUrl } from '../src/sample/strings.js';

describe('sample round questions', () => {
  it('are the three sample-only ids, none of them in the Daily pool', () => {
    const pool = new Set(QUESTIONS.map((q) => q.id));

    expect(SAMPLE_QUESTIONS.map((q) => q.id)).toEqual(['smp-taka', 'smp-enervate', 'smp-nepal-flag']);
    for (const q of SAMPLE_QUESTIONS) expect(pool.has(q.id)).toBe(false);
  });

  it('have four options and an explanation in each language, and file under a known card home', () => {
    for (const q of SAMPLE_QUESTIONS) {
      expect(CARD_HOME[q.category]).toBeTruthy();
      for (const lang of ['en', 'bn']) {
        expect(q[lang].options).toHaveLength(4);
        expect(new Set(q[lang].options).size).toBe(4);
        expect(q[lang].q.length).toBeGreaterThan(5);
        expect(q[lang].why.length).toBeGreaterThan(5);
      }
    }
  });

  it('still point at the right answer after the shuffle, in both languages', () => {
    SAMPLE_QUESTIONS.forEach((q, i) => {
      const raw = SAMPLE_RAW[i];

      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(4);
      expect(q.en.options[q.answer]).toBe(raw.en.options[0]);
      expect(q.bn.options[q.answer]).toBe(raw.bn.options[0]);
      expect([...q.en.options].sort()).toEqual([...raw.en.options].sort());
    });
  });

  it('keep the facts the sources back', () => {
    const [taka, enervate, flag] = SAMPLE_QUESTIONS;

    expect(taka.en.options[taka.answer]).toMatch(/Taka/);
    expect(enervate.en.options[enervate.answer]).toBe('To weaken');
    expect(flag.en.options[flag.answer]).toBe('Nepal');
  });
});

describe('sample round result copy', () => {
  it('uses the misses variants when anything was missed', () => {
    expect(resultKeys(2, 3)).toEqual({ line: 's3Miss', title: 'saveTitle', body: 'saveBody', note: 'laterNote' });
    expect(resultKeys(1, 3).line).toBe('s3MissMany');
    expect(resultKeys(0, 3)).toEqual({ line: 's3MissMany', title: 'saveTitleNone', body: 'saveBody', note: 'laterNote' });
  });

  it('uses the 3-of-3 variants when nothing was missed', () => {
    expect(resultKeys(3, 3)).toEqual({ line: 's3Perfect', title: 'saveTitle', body: 'saveBodyPerfect', note: 'laterNotePerfect' });
  });

  it('has every key in both languages, and never promises "60 seconds"', () => {
    expect(Object.keys(SAMPLE.bn).sort()).toEqual(Object.keys(SAMPLE.en).sort());
    for (const lang of ['en', 'bn']) {
      for (const text of Object.values(SAMPLE[lang])) expect(text).not.toMatch(/60|৬০/);
    }
    expect(SAMPLE.en.saveBody).toMatch(/misses/);
    expect(SAMPLE.en.saveBodyPerfect).not.toMatch(/misses/);
    expect(SAMPLE.en.laterNote).toMatch(/14 days/);
    expect(SAMPLE.bn.laterNote).toMatch(/১৪ দিন/);
  });

  it('shares a /sample link credited to the friend share', () => {
    const url = new URL(shareUrl('https://mnemoq-two.vercel.app'));

    expect(url.pathname).toBe('/sample');
    expect(url.searchParams.get('utm_source')).toBe('friend');
    expect(url.searchParams.get('utm_medium')).toBe('sample_result');
    expect(url.searchParams.get('utm_campaign')).toBe('sample_share');
  });
});
