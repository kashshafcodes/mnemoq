import { describe, expect, it, vi } from 'vitest';

const events = [];
vi.mock('../src/track.js', () => ({ track: (event, props) => events.push([event, props]) }));
vi.mock('../src/googleAnalytics.js', () => ({ trackEvent: () => {} }));
vi.mock('../src/sensory/index.js', () => ({ feel: () => {} }));

const { cardModel, recapWeek } = await import('../src/share/model.js');
const { weeklyRecap, recapWindow } = await import('../src/share/recap.js');
const { award, SHARES_PER_WEEK } = await import('../src/glow/glow.js');
const { earn, loadLedger } = await import('../src/glow/store.js');
const { refCode } = await import('../src/shareCard.js');

const NOW = new Date('2026-11-25T15:00:00Z'); // 21:00 in Dhaka
const DAY = 86400000;
const ago = (d) => new Date(NOW.getTime() - d * DAY).toISOString();

function fakeStore() {
  const data = {};

  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    removeItem: (k) => delete data[k],
  };
}

const marks = [
  { correct: true, bet: 'sure' },
  { correct: true, bet: 'safe' },
  { correct: false, bet: 'guess' },
  { correct: true, bet: 'safe' },
  { correct: false, bet: 'safe' },
];
const diag = {
  pathId: 'sat',
  short: 'SAT',
  isSat: true,
  score: 1240,
  scaleMin: 400,
  scaleMax: 1600,
  sections: ['Reading and Writing', 'Math', 'Extra one', 'Extra two', 'Fifth'].map((name, i) => ({ name, correct: 10 - i, total: 12 })),
};

describe('the share template: three variants, one shape', () => {
  it('daily: kicker with the number, lanterns hero, rank, the Daily link', () => {
    const m = cardModel('daily', 'en', { number: 12, marks, score: 9, max: 15, rank: 3 }, 'user-1');

    expect(m.kicker).toBe('MNEMOQ DAILY · #12');
    expect(m.hero.kind).toBe('lanterns');
    expect(m.hero.marks).toHaveLength(5);
    expect(m.rows[0]).toMatchObject({ kind: 'rank', name: 'Firefly' });
    expect(m.printed).toBe('mnemoq-two.vercel.app/daily');
    expect(m.message).toContain(m.link);
    expect(m.subject).toBe('12');
  });

  it('daily in Bangla: Bangla digits on the card, the brand stays Latin', () => {
    const m = cardModel('daily', 'bn', { number: 12, marks, score: 9, max: 15, rank: 3 }, null);

    expect(m.kicker).toContain('#১২');
    expect(m.kicker).toContain('MNEMOQ');
    expect(m.hero.score).toBe('৯');
    expect(m.line).toContain('তুমি');
  });

  it('diag: score hero, at most 4 sections, the fine print, strong vs starting line', () => {
    const m = cardModel('diag', 'en', diag, 'user-1');

    expect(m.kicker).toBe('MY DIGITAL SAT ESTIMATE');
    expect(m.hero).toMatchObject({ kind: 'score', score: '1240', scale: '/1600' });
    expect(m.rows).toHaveLength(4);
    expect(m.fine).toMatch(/not an official score/);
    expect(m.line).toBe('Can you beat me?');
    expect(m.message).toBe(`My SAT estimate on Mnemoq: 1240. Free 25-minute check: ${m.link}`);
    expect(cardModel('diag', 'en', { ...diag, score: 600 }, 'u').line).toBe('This is where I start. Where do you?');

    const nsu = cardModel('diag', 'bn', { ...diag, pathId: 'nsu', short: 'NSU', isSat: false, score: 64, scaleMin: 0, scaleMax: 100 }, 'u');

    expect(nsu.kicker).toBe('আমার NSU প্রস্তুতি');
    expect(nsu.hero.score).toBe('৬৪');
    expect(nsu.message).toContain('৬৪/১০০');
    expect(new URL(nsu.link).pathname).toBe('/nsu');
  });

  it('recap: days lit hero, three rows, reviewed count under 5 reviews, the sample link', () => {
    const base = { days: recapWindow(NOW), from: '2026-11-19', to: '2026-11-25', dots: ['lit', 'lit', 'rest', 'lit', 'empty', 'lit', 'lit'], daysLit: 5, kept: 7, glow: 120, bestDay: null };
    const few = cardModel('recap', 'en', { ...base, reviewed: 3, recalled: 2, showRate: false }, 'u');

    expect(few.hero).toMatchObject({ kind: 'week', score: '5', dots: base.dots });
    expect(few.rows.map((r) => r.name)).toEqual(['Cards reviewed', 'Cards kept', 'Glow earned']);
    expect(few.rows[2].value).toBe('+120');
    expect(few.printed).toBe('mnemoq-two.vercel.app/sample');
    expect(few.message).toContain('5 days lit');

    const many = cardModel('recap', 'bn', { ...base, reviewed: 20, recalled: 15, showRate: true, bestDay: '2026-11-24' }, 'u');

    expect(many.rows[0]).toMatchObject({ name: 'মনে পড়া কার্ড', value: '২০টির মধ্যে ১৫টি' });
    expect(many.rows).toHaveLength(4);
    expect(many.hero.score).toBe('৫');
    expect(many.subject).toBe(recapWeek('2026-11-25'));
  });

  it('never carries the user id', () => {
    for (const m of [cardModel('daily', 'en', { number: 1, marks, score: 9, rank: 3 }, 'secret-user-id'), cardModel('diag', 'en', diag, 'secret-user-id')]) {
      expect(JSON.stringify(m)).not.toContain('secret-user-id');
      expect(m.link).toContain(`utm_content=${refCode('secret-user-id')}`);
    }
  });
});

describe('weekly recap numbers', () => {
  it('counts the last 7 Dhaka days ending today and locks under 3 days lit', () => {
    expect(recapWindow(NOW)).toEqual(['2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25']);

    const two = weeklyRecap({ reviews: [{ at: ago(0), recalled: true }, { at: ago(1), recalled: false }], now: NOW });

    expect(two.daysLit).toBe(2);
    expect(two.locked).toBe(true);

    const reviews = [0, 1, 1, 3, 3, 3, 9].map((d, i) => ({ at: ago(d), recalled: i % 2 === 0 }));
    const r = weeklyRecap({
      reviews,
      extraDays: [ago(5)],
      glowByDay: { '2026-11-25': 40, '2026-11-22': 10, '2026-11-10': 999 },
      now: NOW,
    });

    expect(r.daysLit).toBe(4); // today, 1, 3 and 5 days ago; 9 days ago is outside
    expect(r.locked).toBe(false);
    expect(r.reviewed).toBe(6);
    expect(r.recalled).toBe(3);
    expect(r.showRate).toBe(true);
    expect(r.glow).toBe(50);
    expect(r.bestDay).toBe('2026-11-22');
    expect(r.dots).toHaveLength(7);
    expect(r.kept).toBe(0);
  });
});

describe('share Glow caps (perks §1)', () => {
  const share = (subject, how = 'image') => ({ type: 'share', variant: 'daily', subject, how });

  it('pays +3 for a real share; save and unknown hows pay 0', () => {
    expect(award(share('1')).amount).toBe(3);
    expect(award(share('1', 'download')).amount).toBe(0);
    expect(award(share('1', 'save')).amount).toBe(0);
    expect(award(share('1', 'whatsapp')).amount).toBe(3);
    expect(award(share('1', 'copy')).amount).toBe(3);
  });

  it('1 a day, 3 a week, once per subject', () => {
    expect(award(share('2'), { day: { shares: 1 } }).reason).toBe('shareDay');
    expect(award(share('2'), { day: {}, weekShares: SHARES_PER_WEEK }).reason).toBe('shareWeek');
    expect(award(share('2'), { day: {}, ever: ['share:daily:2'] }).reason).toBe('again');
  });

  it('through the ledger: +3, then nothing more that day, then 3 a week', () => {
    const store = fakeStore();
    const at = (d) => new Date(NOW.getTime() + d * DAY);
    const go = (subject, d, how) => earn(share(subject, how), { at: at(d), store, user: 'u1', quiet: true });

    expect(go('10', 0).amount).toBe(3);
    expect(go('11', 0).amount).toBe(0); // second share that day
    expect(go('10', 1).amount).toBe(0); // same subject again
    expect(go('12', 1).amount).toBe(3);
    expect(go('13', 2).amount).toBe(3);
    expect(go('14', 3).reason).toBe('shareWeek');
    expect(go('15', 7).amount).toBe(3); // day 0 left the 7-day window
    expect(go('16', 8, 'download').amount).toBe(0);

    const days = loadLedger(store, 'u1').days;

    expect(Object.values(days).reduce((s, d) => s + (d.glow || 0), 0)).toBe(12);
  });
});
