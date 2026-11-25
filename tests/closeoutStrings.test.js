import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STRINGS as PRACTICE, practiceT } from '../src/practice/strings.js';
import { STRINGS as DASH, dashT } from '../src/progress/dashStrings.js';
import { STRINGS as EXAM } from '../src/exam/strings.js';
import { noteMoved, shouldNoticeMove, takeMoved } from '../src/nav/moved.js';

// Phase 2 close-out: the practice library and the Memory map's Details panels
// have Bangla for every English key.
describe('close-out Bangla', () => {
  for (const [name, table] of [['practice', PRACTICE], ['details', DASH], ['exam', EXAM]]) {
    it(`${name}: every English key has a Bangla line`, () => {
      const missing = Object.keys(table.en).filter((key) => !['d.n', 'pr.n', 'ex.n'].includes(key) && !key.endsWith('_one') && !table.bn[key]);

      expect(missing).toEqual([]);
    });
  }

  // Every literal t('key') a screen uses exists in its table (a missing key
  // shows the raw key on screen).
  for (const [file, table] of [
    ['src/practice/KeptMisses.jsx', PRACTICE],
    ['src/components/Practice.jsx', PRACTICE],
    ['src/components/Dashboard.jsx', DASH],
    ['src/components/PathSetup.jsx', EXAM],
  ]) {
    it(`${file}: every key it uses exists`, () => {
      const used = [...readFileSync(file, 'utf8').matchAll(/(?<![\w.])t(?:\.n)?\('([a-z][\w.-]*)'/g)].map((m) => m[1]);
      const missing = used.filter((key) => !table.en[key] && !table.en[`${key}.one`]);

      expect(used.length).toBeGreaterThan(0);
      expect(missing).toEqual([]);
    });
  }

  it('fills numbers in Bangla digits', () => {
    expect(practiceT('bn')('pr.set', { n: 12 })).toBe('সেট ১২');
    expect(dashT('bn').n('d.card', 3)).toBe('৩টি কার্ড');
    expect(dashT('en').n('d.card', 1)).toBe('1 card');
    expect(dashT('en').days(21)).toBe('3 weeks');
    expect(dashT('bn').gap(2 * 3600000)).toBe('২ ঘণ্টা');
  });
});

describe('the moved notice', () => {
  const store = () => {
    const data = new Map();

    return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)) };
  };

  it('shows for a real old name, once', () => {
    const s = store();

    expect(shouldNoticeMove('path')).toBe(true);
    expect(shouldNoticeMove('nonsense')).toBe(false); // a typo sent to Today
    expect(shouldNoticeMove('Today')).toBe(false); // a case change, nothing moved
    expect(noteMoved({ from: 'path', to: 'exam' }, s)).toBe(true);
    expect(takeMoved()).toBe('exam');
    expect(takeMoved()).toBe(null);
    expect(noteMoved({ from: 'path', to: 'exam' }, s)).toBe(false);
    expect(noteMoved({ from: 'profile', to: 'me' }, s)).toBe(true);
  });
});
