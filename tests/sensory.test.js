import { describe, expect, it, vi } from 'vitest';
import { EVENTS, REDUCED_SOUND } from '../src/sensory/events.js';
import { CLASS_CAP, SOUNDS, dbToGain, hz, inKey } from '../src/sensory/sound/palette.js';
import { LIMITER, createEngine } from '../src/sensory/sound/engine.js';
import { CHORDS, barPlan, createMusic, seeded } from '../src/sensory/sound/music.js';
import { createSettings, SENSORY_KEY } from '../src/sensory/settings.js';
import { PATTERNS, createHaptics } from '../src/sensory/haptics.js';
import { createSensory } from '../src/sensory/index.js';

// A fake AudioContext: records nodes and scheduled parameter calls.
function param(value = 1) {
  const calls = [];
  const rec = (name) => (...args) => calls.push([name, ...args]);
  return {
    value,
    calls,
    setValueAtTime: rec('set'),
    linearRampToValueAtTime: rec('linear'),
    exponentialRampToValueAtTime: rec('exp'),
    setTargetAtTime: rec('target'),
    cancelScheduledValues: rec('cancel'),
  };
}

function fakeAC() {
  const made = [];
  class FakeContext {
    constructor(opts) {
      this.opts = opts;
      this.currentTime = 0;
      this.sampleRate = 8000;
      this.state = 'running';
      this.destination = { kind: 'destination' };
      this.suspended = 0;
      this.nodes = [];
      made.push(this);
    }
    node(kind, extra = {}) {
      const n = { kind, connections: [], ...extra };
      n.connect = (to) => n.connections.push(to);
      this.nodes.push(n);
      return n;
    }
    createGain() { return this.node('gain', { gain: param(1) }); }
    createBiquadFilter() { return this.node('filter', { frequency: param(350), Q: param(1), type: 'lowpass' }); }
    createOscillator() { return this.node('osc', { frequency: param(440), detune: param(0), start: vi.fn(), stop: vi.fn() }); }
    createDynamicsCompressor() {
      return this.node('compressor', { threshold: param(-24), knee: param(30), ratio: param(12), attack: param(0.003), release: param(0.25) });
    }
    createConvolver() { return this.node('convolver', { buffer: null }); }
    createDelay() { return this.node('delay', { delayTime: param(0) }); }
    createBufferSource() { return this.node('source', { start: vi.fn(), stop: vi.fn() }); }
    createBuffer(ch, len) {
      const data = Array.from({ length: ch }, () => new Float32Array(len));
      return { getChannelData: (c) => data[c] };
    }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; this.suspended += 1; return Promise.resolve(); }
  }
  return { AC: FakeContext, made };
}

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); }, data };
}

function engineWith({ on = true } = {}) {
  const { AC, made } = fakeAC();
  let ms = 1000;
  const engine = createEngine({ AC, isOn: () => on, now: () => ms, schedule: (fn) => fn() });
  return { engine, made, advance: (d) => { ms += d; }, ctx: () => made[0] };
}

const oscCount = (ctx) => ctx.nodes.filter((n) => n.kind === 'osc').length;

describe('the event map', () => {
  it('gives every event a sound, a haptic decision, a motion decision and a mood', () => {
    for (const [id, ev] of Object.entries(EVENTS)) {
      expect(SOUNDS[ev.sound], id).toBeTruthy();
      expect('haptic' in ev, id).toBe(true);
      if (ev.haptic) expect(PATTERNS[ev.haptic], id).toBeTruthy();
      expect('motion' in ev, id).toBe(true);
      expect(typeof ev.mood, id).toBe('string');
    }
    for (const short of Object.values(REDUCED_SOUND)) expect(SOUNDS[short]).toBeTruthy();
  });

  it('keeps every note in D major pentatonic, and nothing under 220 Hz without the louder partial', () => {
    for (const [id, s] of Object.entries(SOUNDS)) {
      for (const n of s.notes) {
        expect(inKey(n.m), `${id} ${n.m}`).toBe(true);
        if (hz(n.m) < 219.9) expect(n.p2, id).toBe(0.5);
      }
    }
  });

  it('keeps the summed peak of each sound under its class cap (no clipping by design)', () => {
    // A note at time t: a linear attack to its peak, then an exponential decay
    // to -80 dB over d. Sum every note at every note's peak.
    const level = (n, t) => {
      const a = n.a || 5;
      if (t < n.t) return 0;
      if (t < n.t + a) return dbToGain(n.lv) * ((t - n.t) / a);
      const k = Math.min(1, (t - n.t - a) / n.d);
      return dbToGain(n.lv + (-80 - n.lv) * k);
    };
    for (const [id, s] of Object.entries(SOUNDS)) {
      const peaks = s.notes.map((n) => n.t + (n.a || 5));
      const worst = Math.max(...peaks.map((t) => s.notes.reduce((sum, n) => sum + level(n, t), 0)));
      expect(20 * Math.log10(worst), id).toBeLessThanOrEqual(CLASS_CAP[s.cls] + 0.01);
    }
  });

  it('never ticks iOS for flips or embers, and ticks twice to celebrate', () => {
    expect(PATTERNS[EVENTS['card.flip'].haptic].iosTicks).toBe(0);
    expect(PATTERNS[EVENTS['streak.kept'].haptic].iosTicks).toBe(0);
    expect(PATTERNS[EVENTS['round.done'].haptic].iosTicks).toBe(2);
  });
});

describe('the sound engine', () => {
  it('makes no AudioContext and plays nothing before the first tap', () => {
    const { engine, made } = engineWith();
    expect(engine.play('correct')).toBe(0);
    expect(made).toHaveLength(0);
    engine.unlock();
    expect(made).toHaveLength(1);
    expect(made[0].opts).toEqual({ latencyHint: 'interactive' });
    expect(engine.play('correct')).toBeGreaterThan(0);
  });

  it('has a limiter in front of the speakers and a generated reverb', () => {
    const { engine, ctx } = engineWith();
    engine.unlock();
    const limiter = engine.limiter();
    expect(limiter.kind).toBe('compressor');
    expect(limiter.connections).toContain(ctx().destination);
    expect(limiter.threshold.value).toBeLessThanOrEqual(-3);
    expect(limiter.ratio.value).toBe(LIMITER.ratio);
    expect(ctx().nodes.some((n) => n.kind === 'convolver' && n.buffer)).toBe(true);
  });

  it('is silent with Sound off, and while the page is hidden', () => {
    const off = engineWith({ on: false });
    off.engine.unlock();
    expect(off.engine.play('correct')).toBe(0);

    const { engine, ctx } = engineWith();
    engine.unlock();
    engine.setHidden(true);
    expect(ctx().suspended).toBe(1);
    expect(engine.play('correct')).toBe(0);
    engine.setHidden(false);
    expect(engine.play('correct')).toBeGreaterThan(0);
  });

  it('drops the same event twice within 60 ms, and a tap during a fanfare', () => {
    const { engine, advance } = engineWith();
    engine.unlock();
    expect(engine.play('select')).toBeGreaterThan(0);
    advance(30);
    expect(engine.play('select')).toBe(0);
    advance(100);
    expect(engine.play('round.done')).toBeGreaterThan(0);
    advance(100);
    expect(engine.play('tap.primary')).toBe(0);
    advance(2000);
    expect(engine.play('tap.primary')).toBeGreaterThan(0);
  });

  it('ducks the lower buses when a higher sound starts', () => {
    const { engine } = engineWith();
    engine.unlock();
    engine.play('correct');
    const { ui, micro, reward } = engine.buses();
    expect(ui.gain.calls.some(([k, v]) => k === 'target' && v === 0.35)).toBe(true);
    expect(micro.gain.calls.some(([k, v]) => k === 'target' && v === 0.35)).toBe(true);
    expect(reward.gain.calls).toHaveLength(0);
  });

  it('caps voices at 8 by stealing one', () => {
    const { engine, advance, ctx } = engineWith();
    engine.unlock();
    engine.play('round.done'); // 6 voices
    advance(150);
    engine.play('streak.kept'); // 8
    advance(150);
    engine.play('level.up'); // more: steals
    const stolen = ctx().nodes.filter((n) => n.kind === 'gain' && n.gain.calls.some(([k, v]) => k === 'target' && v === 0.0001));
    expect(stolen.length).toBeGreaterThan(0);
  });
});

describe('sensory settings', () => {
  it('defaults to Sound on, Music on (owner), Vibration on', () => {
    expect(createSettings({ storage: memoryStorage() }).get()).toEqual({ sound: true, music: true, vibration: true });
  });

  it('migrates the Daily sound key and the old haptics key', () => {
    const storage = memoryStorage({ 'mnemoq-daily-sound': JSON.stringify({ sound: false, music: false, haptics: true }), 'mnemoq-haptics': '0' });
    expect(createSettings({ storage }).get()).toEqual({ sound: false, music: true, vibration: false });
  });

  it('saves one store and mirrors Vibration for older app versions', () => {
    const storage = memoryStorage();
    const store = createSettings({ storage });
    const seen = vi.fn();
    store.subscribe(seen);
    store.set({ music: false, vibration: false });
    expect(JSON.parse(storage.data[SENSORY_KEY])).toEqual({ sound: true, music: false, vibration: false });
    expect(storage.data['mnemoq-haptics']).toBe('0');
    expect(seen).toHaveBeenCalledTimes(1);
    expect(createSettings({ storage }).get().music).toBe(false);
  });

  it('shares the Vibration switch with haptics, and shrinks celebrations under reduced motion', () => {
    const store = createSettings({ storage: memoryStorage() });
    const nav = { userAgent: 'Android', maxTouchPoints: 5, vibrate: vi.fn() };
    const h = createHaptics({ nav, settings: store });
    store.set({ vibration: false });
    h.haptic.tap();
    expect(nav.vibrate).not.toHaveBeenCalled();
    store.set({ vibration: true });
    h.play('roundDone', { reduced: true });
    expect(nav.vibrate).toHaveBeenCalledWith([18, 60, 20]);
  });
});

describe('music', () => {
  it('never plays one chord three bars running, breathes every 8th bar, and is seeded by the day', () => {
    const run = (seed) => {
      const rand = seeded(seed);
      const bars = [];
      let p = null;
      let p2 = null;
      for (let i = 0; i < 400; i += 1) {
        const plan = barPlan(i, p, p2, rand);
        bars.push(plan);
        p2 = p;
        p = plan.chord;
      }
      return bars;
    };
    const bars = run(20500);
    for (let i = 2; i < bars.length; i += 1) {
      expect(bars[i].chord === bars[i - 1].chord && bars[i].chord === bars[i - 2].chord).toBe(false);
    }
    bars.forEach((b, i) => {
      if (i % 8 === 7) expect(b.plucks).toHaveLength(0);
      expect(b.plucks.length).toBeLessThanOrEqual(3);
      for (const p of b.plucks) expect(inKey(p.m)).toBe(true);
    });
    for (const chord of CHORDS) for (const m of chord) expect(inKey(m)).toBe(true);
    expect(run(20500).map((b) => b.chord)).toEqual(bars.map((b) => b.chord));
    expect(run(20501).map((b) => b.chord)).not.toEqual(bars.map((b) => b.chord));
  });

  function musicWith({ on = true } = {}) {
    const { engine, ctx } = engineWith();
    const timers = new Map();
    let id = 0;
    const music = createMusic({
      engine,
      isOn: () => on,
      every: (fn) => { id += 1; timers.set(id, fn); return id; },
      cancel: (t) => timers.delete(t),
    });
    return { engine, music, timers, ctx };
  }

  it('waits for the first tap, then books bars ahead on the audio clock', () => {
    const { engine, music, timers, ctx } = musicWith();
    music.start();
    expect(music.isPlaying()).toBe(false); // no tap yet
    engine.unlock();
    music.onUnlock();
    expect(music.isPlaying()).toBe(true);
    expect(timers.size).toBe(1);
    const before = oscCount(ctx());
    expect(before).toBeGreaterThan(0);
    ctx().currentTime = 7;
    timers.forEach((fn) => fn());
    expect(oscCount(ctx())).toBeGreaterThan(before);
  });

  it('stops, resolves and pauses cleanly; nothing is booked while hidden', () => {
    const { engine, music, timers, ctx } = musicWith();
    engine.unlock();
    music.start();
    engine.setHidden(true);
    music.pause();
    expect(timers.size).toBe(0);
    engine.setHidden(false);
    music.resume();
    expect(music.isPlaying()).toBe(true);
    const n = oscCount(ctx());
    music.resolve();
    expect(oscCount(ctx())).toBeGreaterThan(n); // the home chord
    expect(music.isPlaying()).toBe(false);
    expect(timers.size).toBe(0);
    music.resume(); // the round is over: no restart
    expect(music.isPlaying()).toBe(false);
  });

  it('respects the Music switch', () => {
    const { engine, music } = musicWith({ on: false });
    engine.unlock();
    music.start();
    expect(music.isPlaying()).toBe(false);
  });
});

describe('feel()', () => {
  function fakeWindow(AC, reduced = false) {
    const listeners = {};
    return {
      AudioContext: AC,
      addEventListener: (type, fn) => { listeners[type] = fn; },
      matchMedia: () => ({ matches: reduced }),
      fire: (type) => listeners[type]?.(),
    };
  }
  const visibleDoc = () => ({ hidden: false, addEventListener: () => {} });
  const fakeEl = () => ({ classList: { add: vi.fn(), remove: vi.fn() }, addEventListener: vi.fn() });

  it('fires sound, haptic and motion together, with audio only after the first tap', () => {
    const { AC, made } = fakeAC();
    const win = fakeWindow(AC);
    const haptic = vi.fn();
    const s = createSensory({ win, doc: visibleDoc(), nav: {}, store: createSettings({ storage: memoryStorage() }), haptic, dev: true });
    const el = fakeEl();

    s.feel('correct', { el });
    expect(made).toHaveLength(0); // no audio before a gesture
    expect(haptic).toHaveBeenCalledWith('correct', { reduced: false });
    expect(el.classList.add).toHaveBeenCalledWith('fx-pop');

    win.fire('pointerdown');
    s.feel('wrong');
    expect(made).toHaveLength(1);
    expect(s.log.map((e) => e.id)).toEqual(['correct', 'wrong']);
    expect(s.log[1].sound).toBe(true);
  });

  it('never throws: unknown ids, no AudioContext, a hidden page, a failing haptic', () => {
    const doc = { hidden: true, addEventListener: () => {} };
    const s = createSensory({
      win: { addEventListener: () => {} },
      doc,
      nav: {},
      store: createSettings({ storage: memoryStorage() }),
      haptic: () => { throw new Error('x'); },
    });
    expect(() => s.feel('nope')).not.toThrow();
    expect(() => s.feel('correct')).not.toThrow();
    doc.hidden = false;
    s.onGesture();
    expect(() => s.feel('round.done')).not.toThrow();
  });

  it('keeps the sound but drops motion and shrinks the celebration under reduced motion', () => {
    const { AC } = fakeAC();
    const win = fakeWindow(AC, true);
    const haptic = vi.fn();
    const s = createSensory({ win, doc: visibleDoc(), nav: {}, store: createSettings({ storage: memoryStorage() }), haptic, dev: true });
    const el = fakeEl();
    win.fire('click');
    s.feel('round.done', { el });
    expect(s.log[0].sound).toBe(true);
    expect(haptic).toHaveBeenCalledWith('roundDone', { reduced: true });
    expect(el.classList.add).not.toHaveBeenCalled();
  });

  it('pauses the music when the page is hidden and resumes it inside the round', () => {
    const { AC, made } = fakeAC();
    const win = fakeWindow(AC);
    let onVis;
    const doc = { hidden: false, addEventListener: (t, fn) => { if (t === 'visibilitychange') onVis = fn; } };
    const s = createSensory({ win, doc, nav: {}, store: createSettings({ storage: memoryStorage() }), haptic: () => {}, every: () => 1, cancel: () => {} });
    win.fire('pointerdown');
    s.music.start();
    expect(s.music.isPlaying()).toBe(true);
    doc.hidden = true;
    onVis();
    expect(s.music.isPlaying()).toBe(false);
    expect(made[0].state).toBe('suspended');
    doc.hidden = false;
    onVis();
    expect(s.music.isPlaying()).toBe(true);
  });

  it('plays music only where a round asks for it: the store alone never starts it', () => {
    const { AC } = fakeAC();
    const win = fakeWindow(AC);
    const store = createSettings({ storage: memoryStorage() });
    const s = createSensory({ win, doc: visibleDoc(), nav: {}, store, haptic: () => {}, every: () => 1, cancel: () => {} });
    win.fire('pointerdown');
    store.set({ music: false });
    store.set({ music: true });
    expect(s.music.isPlaying()).toBe(false); // no round, no music
    s.music.start();
    expect(s.music.isPlaying()).toBe(true);
    store.set({ sound: false });
    expect(s.music.isPlaying()).toBe(false); // Sound off silences music too
    s.music.stop();
    store.set({ sound: true });
    expect(s.music.isPlaying()).toBe(false); // left the round
  });
});
