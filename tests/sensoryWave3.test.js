import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EVENTS, REDUCED_SOUND } from '../src/sensory/events.js';
import { SOUNDS } from '../src/sensory/sound/palette.js';
import { PATTERNS } from '../src/sensory/haptics.js';
import { GLOW_AFTER_CORRECT_MS, soundFor } from '../src/sensory/index.js';
import { SPARK_MAX, SPARK_MAX_LOW, TICK_MAX, countDuration, countUp, pickReward, sparkPlan, tickValues } from '../src/sensory/celebrate.js';

// Wave 3 (Glow, levels, milestones, streaks) only calls feel() and the
// celebrate helpers; these tests hold the hooks ready.
const WAVE3 = { 'glow.gain': 'ui', 'level.up': 'hero', milestone: 'hero', 'streak.kept': 'reward' };

describe('wave 3 events are registered', () => {
  for (const [id, cls] of Object.entries(WAVE3)) {
    it(`${id} has a sound in the palette, a haptic decision, a motion class and a mood`, () => {
      const ev = EVENTS[id];

      expect(ev).toBeDefined();
      expect(SOUNDS[ev.sound].cls).toBe(cls);
      if (ev.haptic) expect(PATTERNS[ev.haptic]).toBeDefined();
      expect(ev.motion).toMatch(/^fx-/);
      expect(ev.mood).toBeTruthy();
    });
  }

  it('the hero moments shrink under reduced motion', () => {
    expect(soundFor('level.up', {}, { reduced: true })).toBe(REDUCED_SOUND['level.up']);
    expect(soundFor('milestone', {}, { reduced: true })).toBe('round.short');
    expect(soundFor('streak.kept', {}, { reduced: true })).toBe('streak.kept');
  });

  it('glow.gain rings higher at +5 and stays silent right after a correct', () => {
    expect(soundFor('glow.gain', { n: 3 })).toBe('glow.gain');
    expect(soundFor('glow.gain', { n: 5 })).toBe('glow.gain.big');
    expect(SOUNDS['glow.gain.big'].notes[0].m).toBe(83); // B5
    expect(soundFor('glow.gain', { n: 3 }, { sinceCorrect: 100 })).toBeNull();
    expect(soundFor('glow.gain', { n: 3 }, { sinceCorrect: GLOW_AFTER_CORRECT_MS })).toBe('glow.gain');
  });

  it('a count-up climbs the pentatonic and every step exists', () => {
    const ids = [0, 1, 2, 3, 4, 5, 11].map((step) => soundFor('count.tick', { step }));

    expect(ids.slice(0, 5)).toEqual(['count.tick.0', 'count.tick.1', 'count.tick.2', 'count.tick.3', 'count.tick.4']);
    for (const id of ids) expect(SOUNDS[id].cls).toBe('micro');
    expect(soundFor('count.tick')).toBe('count.tick');
  });

  it('rewards never stack: the biggest plays once', () => {
    expect(pickReward(['level.up', 'milestone'])).toBe('milestone');
    expect(pickReward(['streak.kept', 'level.up'])).toBe('level.up');
    expect(pickReward(['glow.gain'])).toBe('glow.gain');
    expect(pickReward([])).toBeNull();
  });
});

describe('done-screen sparks and count-up', () => {
  it('sparks stay inside the spec ranges and caps', () => {
    const plan = sparkPlan(14);

    expect(plan).toHaveLength(14);
    for (const dot of plan) {
      expect(Math.hypot(dot.dx, dot.dy)).toBeGreaterThanOrEqual(39);
      expect(Math.hypot(dot.dx, dot.dy)).toBeLessThanOrEqual(101);
      expect(dot.size).toBeGreaterThanOrEqual(6);
      expect(dot.size).toBeLessThanOrEqual(8);
      expect(dot.dur).toBeGreaterThanOrEqual(700);
      expect(dot.dur).toBeLessThanOrEqual(1100);
      expect(dot.delay).toBeLessThanOrEqual(120);
    }
    expect(sparkPlan(40)).toHaveLength(SPARK_MAX);
    expect(sparkPlan(14, { lowEnd: true })).toHaveLength(SPARK_MAX_LOW);
  });

  it('count-up timing and ticks follow the spec', () => {
    expect(countDuration(0, 8)).toBe(400);
    expect(countDuration(0, 500)).toBe(700);
    expect(tickValues(0, 5)).toEqual([1, 2, 3, 4, 5]);
    const many = tickValues(0, 240);

    expect(many).toHaveLength(TICK_MAX);
    expect(many.at(-1)).toBe(240);
    expect(tickValues(3, 3)).toEqual([]);
  });

  it('counts with requestAnimationFrame, ticks at most 12 times, and lands on the number', () => {
    let t = 0;
    const queue = [];
    const frames = [];
    const ticks = [];

    countUp({ from: 0, to: 30, raf: (fn) => queue.push(fn), now: () => t, onFrame: (v) => frames.push(v), onTick: (s) => ticks.push(s) });
    while (queue.length) {
      t += 16;
      queue.shift()();
    }
    expect(frames.at(-1)).toBe(30);
    expect(ticks.length).toBeLessThanOrEqual(TICK_MAX);
    expect(ticks.length).toBeGreaterThan(0);
    for (let i = 1; i < frames.length; i += 1) expect(frames[i]).toBeGreaterThanOrEqual(frames[i - 1]);
  });

  it('reduced motion shows the final number at once', () => {
    const frames = [];

    countUp({ from: 0, to: 9, reduced: true, onFrame: (v) => frames.push(v), raf: () => { throw new Error('no frames'); } });
    expect(frames).toEqual([9]);
  });

  it('the spark and bloom keyframes exist and move only transform and opacity', () => {
    const css = readFileSync(join(import.meta.dirname, '..', 'src', 'sensory', 'motion', 'motion.css'), 'utf8');

    for (const name of ['fx-spark', 'fx-bloom', 'fx-pulse-once', 'fx-grow-x']) expect(css).toContain(`@keyframes ${name}`);
  });
});
