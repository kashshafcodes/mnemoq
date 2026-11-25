import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeAnalytics, computeStreaks } from '../src/analytics.js';
import { buildAchievements as pathAchievements } from '../src/missions.js';
import { buildAchievements as satAchievements } from '../src/sat/coach.js';
import { grownNodes, keptCards, memoryMapData, readinessBlock, skillRows, snapshot } from '../src/progress/mapData.js';
import { STRINGS } from '../src/progress/strings.js';
import { streakFromKeys } from '../src/glow/streak.js';
import { streakDue } from '../api/_push.js';
import { runReminders } from '../api/remind.js';

// 18:00 in Dhaka on 25 Nov.
const now = new Date('2026-11-25T12:00:00Z');
const at = (d) => new Date(`2026-11-${d}T06:00:00Z`); // noon in Dhaka
// Reviews on 22, 24, 25; other learning (Daily, drills) on 16-21; 23 is a rest day.
const reviews = ['22', '24', '25'].map((d, i) => ({ id: String(i), cardId: 'c1', subject: 'Maths', recalled: true, at: at(d) }));
const extraDays = ['16', '17', '18', '19', '20', '21'].map(at);
const cards = [
  { id: 'a', subject: 'Maths', reviewCount: 0 },
  { id: 'b', subject: 'Maths', reviewCount: 2, reviewIntervalDays: 1 },
  { id: 'c', subject: 'Maths', reviewCount: 3, reviewIntervalDays: 5 },
  { id: 'd', subject: 'Physics', reviewCount: 6, mastered: true },
];

describe('one streak everywhere', () => {
  it('every surface shows the same number for the same data', () => {
    const one = computeStreaks(reviews, now, extraDays);

    expect(one.current).toBe(9);
    expect(one.restUsed).toBe(1);
    // Reviews alone would say 3: the old Path/SAT number.
    expect(computeStreaks(reviews, now).current).toBe(3);

    // Today (Home, GlowLine, Daily tile), Profile and the Details panels.
    const home = computeAnalytics(cards, reviews, now, { extraDays }).stats.streak;
    // The Memory map.
    const map = memoryMapData({ cards, reviews, extraDays, now }).streak;
    // Path and SAT dashboards call computeStreaks with the same extra days.
    const path = pathAchievements({ cards, reviews, mocks: [], readiness: null, target: 70, hasDiagnostic: false, now, extraDays });
    const sat = satAchievements({ estimate: { overall: null }, map: { skills: {} }, cards, reviews, mocks: [], target: 1300, hasDiagnostic: false, now, extraDays });

    for (const s of [home, map]) {
      expect(s.current).toBe(one.current);
      expect(s.best).toBe(one.best);
      expect(s.restUsed).toBe(one.restUsed);
    }
    expect(path.find((a) => a.id === 'streak7').unlocked).toBe(true);
    expect(sat.find((a) => a.id === 'streak7').unlocked).toBe(true);
    expect(path.find((a) => a.id === 'streak30').value).toBe(one.best);
    expect(sat.find((a) => a.id === 'streak30').value).toBe(one.best);
  });

  it('the reminder job reads the same rule from day keys', () => {
    const keys = [...reviews.map((r) => r.at), ...extraDays].map((d) => new Date(d.getTime() + 6 * 3600000).toISOString().slice(0, 10));
    const server = streakFromKeys(new Set(keys), '2026-11-25');
    const app = computeStreaks(reviews, now, extraDays);

    expect(server.current).toBe(app.current);
    expect(server.atRisk).toBe(app.atRisk);
  });
});

describe('streakDue with rest days', () => {
  const person = { enabled: true, streak_nudge: true, timezone: 'Asia/Dhaka', quiet_start: '23:30', quiet_end: '07:00' };
  const evening = new Date('2026-11-15T14:30:00Z'); // 20:30 in Dhaka

  it('never nags while a rest day is left', () => {
    // Yesterday only: today is a free rest day.
    expect(streakDue(person, new Set(['2026-11-14']), evening, 5)).toBe(false);
    // One rest day used (13 Nov): one is still free.
    expect(streakDue(person, new Set(['2026-11-10', '2026-11-11', '2026-11-12', '2026-11-14']), evening, 5)).toBe(false);
  });

  it('nudges only when both rest days are used and something is due', () => {
    const both = new Set(['2026-11-09', '2026-11-10', '2026-11-12', '2026-11-14']);

    expect(streakDue(person, both, evening, 5)).toBe(true);
    expect(streakDue(person, both, evening, 0)).toBe(false);
    // Already learned today: nothing to keep.
    expect(streakDue(person, new Set([...both, '2026-11-15']), evening, 5)).toBe(false);
    // No streak at all: nothing to lose.
    expect(streakDue(person, new Set(), evening, 5)).toBe(false);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('the job counts learning days (Daily, drills), not only reviews', async () => {
    const calls = [];

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        const u = String(url);
        const json = (body) => ({ ok: true, status: 200, json: async () => body, headers: new Headers() });

        calls.push(u);
        if (u.includes('/reminder_settings?select')) {
          return json(Number(new URL(u).searchParams.get('offset')) ? [] : [{ user_id: 's', ...person, remind_time: '06:00', last_sent_on: '2026-11-15' }]);
        }
        if (u.includes('/push_subscriptions?select')) return json([{ user_id: 's', endpoint: 'https://fcm.googleapis.com/fcm/send/s' }]);
        if (u.includes('/reviews?select')) return json([{ user_id: 's', created_at: '2026-11-14T13:00:00Z' }]);
        if (u.includes('/learning_days?select')) return json(['09', '10', '12'].map((d) => ({ user_id: 's', day: `2026-11-${d}`, sources: { daily: 1 } })));
        if (u.includes('/mistakes?select')) return { ok: true, headers: new Headers({ 'content-range': '0-0/3' }) };

        return { ok: true, status: 204, json: async () => null, headers: new Headers() };
      })
    );
    const webpush = { setVapidDetails: vi.fn(), sendNotification: vi.fn(async () => ({})) };
    const env = { VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv', CRON_SECRET: 'x'.repeat(20) };
    const result = await runReminders({ env, now: evening, webpush, cfg: { url: 'https://db.example', key: 'service' } });

    expect(calls.some((u) => u.includes('/learning_days?select=user_id,day') && u.includes('day=gte.2026-11-01'))).toBe(true);
    expect(result.streak).toBe(1);
  });
});

describe('Memory map data', () => {
  it('counts kept cards as strong or mastered, with the four stages', () => {
    const kept = keptCards(cards);

    expect(kept).toMatchObject({ n: 2, total: 4 });
    expect(kept.stages.map((s) => s.count)).toEqual([1, 1, 1, 1]);
  });

  it('skills: path sections when there is a path, else subjects with 5+ reviews', () => {
    const sections = [{ id: 'math', name: 'Math', score: 610 }, { id: 'rw', name: 'Reading', score: null }];

    expect(skillRows(cards, reviews, { engine: 'sat', sections })).toEqual([
      { id: 'math', name: 'Math', score: 610, max: 800 },
      { id: 'rw', name: 'Reading', score: null, max: 800 },
    ]);
    // 3 Maths reviews: not enough yet.
    expect(skillRows(cards, reviews).find((s) => s.name === 'Maths').score).toBe(null);
    const more = [...reviews, ...reviews.slice(0, 2).map((r) => ({ ...r, recalled: false }))];
    expect(skillRows(cards, more).find((s) => s.name === 'Maths').score).toBe(60);
  });

  it('readiness never makes a number up', () => {
    expect(readinessBlock(null)).toEqual({ kind: 'noPath' });
    expect(readinessBlock({ short: 'SAT', hasDiagnostic: false, readiness: null }).kind).toBe('noCheck');
    expect(
      readinessBlock({ short: 'SAT', hasDiagnostic: true, readiness: 1180, target: 1300, daysLeft: 41, progress: { band: 'building' }, weakest: { id: 'm', name: 'Algebra', score: 500 } })
    ).toEqual({ kind: 'score', name: 'SAT', score: 1180, target: 1300, daysLeft: 41, band: 'building', weakest: { id: 'm', name: 'Algebra' } });
  });

  it('new user: empty map, Spark, no skills, 14 empty days', () => {
    const data = memoryMapData({ now });

    expect(data.empty).toBe(true);
    expect(data.skills).toEqual([]);
    expect(data.glow.level).toBe(1);
    expect(data.kept).toMatchObject({ n: 0, total: 0 });
    expect(data.streak.days).toHaveLength(14);
    expect(data.streak.days.every((d) => d.state === 'before' || d.state === 'today')).toBe(true);
  });

  it('history failed: streak and Glow unknown, never 0; cards still count', () => {
    const data = memoryMapData({ cards, reviews: [], historyOk: false, glowTotal: 50, now });

    expect(data.streak).toBe(null);
    expect(data.glow).toBe(null);
    expect(data.kept.n).toBe(2);
    expect(data.empty).toBe(false);
  });

  it('pulses only the blocks that grew since the last visit', () => {
    const data = memoryMapData({ cards, reviews, extraDays, glowTotal: 120, now });
    const seen = snapshot(data);

    expect(grownNodes(null, data)).toEqual([]);
    expect(grownNodes(seen, data)).toEqual([]);
    expect(grownNodes({ ...seen, streak: seen.streak - 1, kept: 1 }, data)).toEqual(['streak', 'kept']);
  });

  it('has every map key in English and Bangla', () => {
    expect(Object.keys(STRINGS.bn).sort()).toEqual(Object.keys(STRINGS.en).sort());
    for (const line of Object.keys(STRINGS.en).filter((k) => k.startsWith('feel.map.'))) {
      expect(STRINGS.en[line].split(' ').length).toBeLessThanOrEqual(10);
    }
  });
});
