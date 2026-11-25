// The sound engine: one AudioContext, created on the first tap (never at
// load), five class buses, a generated reverb, ducking, rate limits and a
// safety limiter. Every sound is synthesised from the palette; no files.
//
// Chain (spec phase2-sensory 1.2):
//   voice -> lowpass -> envelope -> class bus -> master 0.9 -> limiter -> out
//                                         \-> send -> reverb (wet 0.5) -> master
//   music: fade -> duck -> lowpass 2.2k -> master, and a 0.25 send to the reverb
//
// Tests build their own engine with a fake AudioContext.

import { CLASS_CAP, RANK, REVERB_SEND, SOUNDS, dbToGain, hz, lengthOf } from './palette.js';

const START_AHEAD = 0.005; // schedule 5 ms ahead of "now" on the audio clock
const SAME_EVENT_MS = 60;
const MAX_VOICES = 8;
const MAX_STARTS = 3; // per 100 ms
const DUCK_TO = 0.35;
// Safety net, not a mixing tool: threshold -6 dB at ratio 20 keeps the true
// peak under -3 dBFS. Nothing in the palette should ever reach it.
export const LIMITER = { threshold: -6, knee: 0, ratio: 20, attack: 0.002, release: 0.12 };

export { CLASS_CAP };

export function makeImpulse(ctx, { seconds = 0.9, power = 3.5, preDelay = 0.012, random = Math.random } = {}) {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  const buffer = ctx.createBuffer(2, len, sr);

  for (let c = 0; c < 2; c += 1) {
    const data = buffer.getChannelData(c);
    let smooth = 0;

    for (let i = 0; i < len; i += 1) {
      smooth += (random() * 2 - 1 - smooth) * 0.35; // a one-pole lowpass: a dark tail
      data[i] = i < sr * preDelay ? 0 : smooth * (1 - i / len) ** power;
    }
  }

  return buffer;
}

export function createEngine({ AC, isOn = () => true, now = () => Date.now(), schedule = (fn, ms) => setTimeout(fn, ms), nav } = {}) {
  let ctx = null;
  let master = null;
  let limiter = null;
  let reverbIn = null;
  let legacyBus = null;
  let music = null; // { fade, duck }
  const buses = {};
  const lastAt = {};
  let starts = [];
  let voices = [];
  let busy = { rank: -1, until: 0 };
  let unlocked = false;
  let hidden = false;

  function build() {
    if (!AC) return false;

    try {
      ctx = new AC({ latencyHint: 'interactive' });
    } catch {
      ctx = null;
      return false;
    }

    // iPhone: ask for an "ambient" session so the ring switch mutes us
    // (Safari 16.4+; unverified on a real phone, spec 1.5).
    try {
      if (nav?.audioSession) nav.audioSession.type = 'ambient';
    } catch {
      // Not supported; fine.
    }

    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = LIMITER.threshold;
    limiter.knee.value = LIMITER.knee;
    limiter.ratio.value = LIMITER.ratio;
    limiter.attack.value = LIMITER.attack;
    limiter.release.value = LIMITER.release;
    limiter.connect(ctx.destination);

    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(limiter);

    // The reverb input is a plain gain, so sounds can be sent before the
    // impulse is ready; the convolver is attached a moment later.
    reverbIn = ctx.createGain();
    schedule(attachReverb, 0);

    for (const cls of Object.keys(RANK)) {
      const bus = ctx.createGain();
      const send = ctx.createGain();

      send.gain.value = REVERB_SEND[cls];
      bus.connect(master);
      bus.connect(send);
      send.connect(reverbIn);
      buses[cls] = bus;
    }

    // The Daily's own voices (start, charge, correct, fanfare, melody) at
    // their old level, on the same master, limiter and reverb.
    legacyBus = ctx.createGain();
    legacyBus.gain.value = 0.55;
    legacyBus.connect(master);
    const legacySend = ctx.createGain();
    legacySend.gain.value = 0.15;
    legacyBus.connect(legacySend);
    legacySend.connect(reverbIn);

    const fade = ctx.createGain();
    const duck = ctx.createGain();
    const tone = ctx.createBiquadFilter();
    const send = ctx.createGain();

    fade.gain.value = 0;
    tone.type = 'lowpass';
    tone.frequency.value = 2200;
    send.gain.value = 0.25;
    fade.connect(duck);
    duck.connect(tone);
    tone.connect(master);
    tone.connect(send);
    send.connect(reverbIn);
    music = { fade, duck };

    return true;
  }

  function attachReverb() {
    if (!ctx) return;

    const wet = ctx.createGain();

    wet.gain.value = 0.5;
    wet.connect(master);

    try {
      const verb = ctx.createConvolver();

      verb.buffer = makeImpulse(ctx);
      reverbIn.connect(verb);
      verb.connect(wet);
    } catch {
      // Fallback: the old delay "room".
      const delay = ctx.createDelay(1);
      const feedback = ctx.createGain();
      const tone = ctx.createBiquadFilter();

      delay.delayTime.value = 0.23;
      feedback.gain.value = 0.3;
      tone.type = 'lowpass';
      tone.frequency.value = 2400;
      reverbIn.connect(delay);
      delay.connect(tone);
      tone.connect(feedback);
      feedback.connect(delay);
      tone.connect(wet);
    }
  }

  function ready() {
    if (!unlocked || hidden) return false;
    if (!ctx && !build()) return false;
    if (ctx.state === 'suspended') ctx.resume?.()?.catch?.(() => {});

    return true;
  }

  function stealIfFull(t) {
    voices = voices.filter((v) => v.end > t);
    if (voices.length < MAX_VOICES) return;

    let victim = voices[0];

    for (const v of voices) if (v.rank < victim.rank) victim = v;
    victim.env.gain.cancelScheduledValues(t);
    victim.env.gain.setTargetAtTime(0.0001, t, 0.01);
    voices = voices.filter((v) => v !== victim);
  }

  function bell(n, t0, bus, rank, gainMul) {
    const f = hz(n.m);
    const peak = Math.max(dbToGain(n.lv) * gainMul, 0.0002);
    const a = (n.a || 5) / 1000;
    const d = n.d / 1000;

    stealIfFull(t0);

    const lp = ctx.createBiquadFilter();
    const env = ctx.createGain();

    lp.type = 'lowpass';
    lp.frequency.value = n.lp || 5000;
    lp.Q.value = 0.5;
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(peak, t0 + a);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    lp.connect(env);
    env.connect(bus);

    for (const [ratio, level] of [
      [1, 1],
      [2.01, n.p2 ?? 0.25],
    ]) {
      const osc = ctx.createOscillator();
      const og = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * ratio, t0);
      if (n.g) osc.frequency.exponentialRampToValueAtTime(f * ratio * 2 ** (n.g / 12), t0 + a + d * 0.8);
      og.gain.value = level;
      osc.connect(og);
      og.connect(lp);
      osc.start(t0);
      osc.stop(t0 + a + d + 0.05);
    }

    if (n.noise) {
      const src = ctx.createBufferSource();
      const bp = ctx.createBiquadFilter();
      const ng = ctx.createGain();
      const len = Math.floor(ctx.sampleRate * 0.02);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);

      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      src.buffer = buf;
      bp.type = 'bandpass';
      bp.frequency.value = 3200;
      bp.Q.value = 1.2;
      ng.gain.setValueAtTime(dbToGain(-38) * gainMul, t0);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.012);
      src.connect(bp);
      bp.connect(ng);
      ng.connect(bus);
      src.start(t0);
      src.stop(t0 + 0.02);
    }

    voices.push({ end: t0 + a + d + 0.05, rank, env });
  }

  function duckMusic(rank, ms) {
    if (!music || rank < RANK.feedback) return;

    const t = ctx.currentTime;
    const g = music.duck.gain;
    const hero = rank >= RANK.hero;

    g.cancelScheduledValues(t);
    g.setTargetAtTime(hero ? 0.25 : 0.5, t, 0.015);
    g.setTargetAtTime(1, t + (hero ? 2 : ms / 1000), 0.4 / 3);
  }

  function duck(rank, ms) {
    const t = ctx.currentTime;

    for (const [cls, r] of Object.entries(RANK)) {
      if (r >= rank) continue;
      const g = buses[cls].gain;

      g.cancelScheduledValues(t);
      g.setTargetAtTime(DUCK_TO, t, 0.012);
      g.setTargetAtTime(1, t + (ms * 0.6) / 1000, 0.1 / 3);
    }

    duckMusic(rank, ms);
  }

  // Play one palette sound. Returns its length in ms, or 0 when it was not
  // played (sound off, no tap yet, hidden, rate-limited, outranked).
  function play(id, { gain = 1 } = {}) {
    const sound = SOUNDS[id];

    if (!sound || !isOn() || !ready()) return 0;

    const ms = now();
    const rank = RANK[sound.cls];

    if (ms - (lastAt[id] ?? -1e9) < SAME_EVENT_MS) return 0;
    if (busy.rank > rank && ms < busy.until) return 0; // taps never fight a fanfare
    starts = starts.filter((s) => ms - s < 100);
    if (starts.length >= MAX_STARTS) return 0;

    lastAt[id] = ms;
    starts.push(ms);

    try {
      const t0 = ctx.currentTime + START_AHEAD;
      const length = lengthOf(id);

      for (const n of sound.notes) bell(n, t0 + n.t / 1000, buses[sound.cls], rank, gain);
      duck(rank, length);
      if (rank >= busy.rank || ms >= busy.until) busy = { rank, until: ms + length };

      return length;
    } catch {
      return 0;
    }
  }

  // One free-form voice, for the Daily's kept sounds (D8).
  function voice({ freq, type = 'sine', at = 0, attack = 0.005, decay = 0.25, peak = 0.3, detune = 0, glideTo, music: toMusic = false }) {
    if (!(toMusic || isOn()) || !ready()) return;

    const t0 = ctx.currentTime + START_AHEAD + at;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + attack + decay);
    osc.detune.value = detune;
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    osc.connect(env);
    env.connect(toMusic ? music.fade : legacyBus);
    osc.start(t0);
    osc.stop(t0 + attack + decay + 0.05);
  }

  return {
    play,
    voice,
    duckMusic: (rank, ms) => {
      if (ctx) duckMusic(rank, ms);
    },
    // Called from the first-gesture listeners (pointerdown, keydown, ...).
    unlock() {
      unlocked = true;
      if (!hidden) ready();
    },
    setHidden(next) {
      hidden = Boolean(next);
      if (!ctx) return;
      if (hidden) ctx.suspend?.()?.catch?.(() => {});
      else if (unlocked) ctx.resume?.()?.catch?.(() => {});
    },
    ready,
    isUnlocked: () => unlocked,
    isHidden: () => hidden,
    context: () => ctx,
    musicBus: () => music?.fade || null,
    limiter: () => limiter,
    buses: () => buses,
  };
}
