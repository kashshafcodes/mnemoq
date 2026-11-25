import { describe, expect, it, vi } from 'vitest';
import { PATTERNS, createHaptics, detectPlatform } from '../src/haptics.js';

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  android: 'Mozilla/5.0 (Linux; Android 14; SM-A146B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
};

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
    data,
  };
}

function fakeDoc() {
  const clicks = [];
  const make = (tag) => {
    const el = {
      tag,
      style: {},
      attrs: {},
      children: [],
      isConnected: false,
      setAttribute(k, v) {
        el.attrs[k] = v;
      },
      appendChild(child) {
        el.children.push(child);
        child.isConnected = true;
      },
      addEventListener() {},
      click: () => clicks.push(tag),
    };
    return el;
  };
  const body = make('body');
  return { body, clicks, createElement: make };
}

const android = () => ({ userAgent: UA.android, maxTouchPoints: 5, vibrate: vi.fn(() => true) });
const iphone = () => ({ userAgent: UA.iphone, platform: 'iPhone', maxTouchPoints: 5 });

describe('haptics platform detection', () => {
  it('finds iPhone, iPadOS-as-Mac, Android and desktop', () => {
    expect(detectPlatform(iphone())).toBe('ios');
    expect(detectPlatform({ userAgent: UA.ipad, platform: 'MacIntel', maxTouchPoints: 5 })).toBe('ios');
    expect(detectPlatform(android())).toBe('vibrate');
    // Desktop Chrome has navigator.vibrate but no motor.
    expect(detectPlatform({ userAgent: UA.desktop, platform: 'Win32', maxTouchPoints: 0, vibrate: () => true })).toBe('none');
    // A real Mac has no touch screen.
    expect(detectPlatform({ userAgent: UA.ipad, platform: 'MacIntel', maxTouchPoints: 0 })).toBe('none');
    expect(detectPlatform(null)).toBe('none');
    expect(detectPlatform({})).toBe('none');
  });
});

describe('haptic events', () => {
  it('maps each event to its pattern on Android', () => {
    const nav = android();
    const { haptic } = createHaptics({ nav, storage: memoryStorage() });

    for (const name of ['tap', 'select', 'correct', 'wrong', 'celebrate', 'error']) {
      nav.vibrate.mockClear();
      haptic[name]();
      expect(nav.vibrate).toHaveBeenCalledTimes(1);
      expect(nav.vibrate).toHaveBeenCalledWith(PATTERNS[name].android);
    }

    nav.vibrate.mockClear();
    haptic.charge(3);
    expect(nav.vibrate).toHaveBeenCalledWith(PATTERNS.charged.android);
  });

  it('keeps Android patterns short: at most 450 ms and 4 pulses (sensory spec 3)', () => {
    for (const { android: p } of Object.values(PATTERNS)) {
      const list = [].concat(p);
      const total = list.reduce((a, b) => a + b, 0);
      expect(total).toBeLessThanOrEqual(450);
      expect(Math.ceil(list.length / 2)).toBeLessThanOrEqual(4);
    }
  });

  it('does not vibrate before the first tap on the page (Chrome would log an error)', () => {
    const nav = { ...android(), userActivation: { hasBeenActive: false } };
    const { haptic } = createHaptics({ nav, storage: memoryStorage() });

    haptic.tap();
    expect(nav.vibrate).not.toHaveBeenCalled();

    nav.userActivation.hasBeenActive = true;
    haptic.tap();
    expect(nav.vibrate).toHaveBeenCalledTimes(1);
  });

  it('ticks the hidden switch on iPhone: synchronously, once, and twice only to celebrate', () => {
    const doc = fakeDoc();
    const later = [];
    const { haptic } = createHaptics({ nav: iphone(), doc, storage: memoryStorage(), schedule: (fn) => later.push(fn) });

    haptic.correct();
    expect(doc.clicks).toEqual(['label']);
    expect(later).toHaveLength(0);

    haptic.celebrate();
    expect(doc.clicks).toHaveLength(2);
    later.forEach((fn) => fn());
    expect(doc.clicks).toHaveLength(3);

    // One switch, reused; hidden from screen readers and from focus.
    expect(doc.body.children).toHaveLength(1);
    const label = doc.body.children[0];
    expect(label.attrs['aria-hidden']).toBe('true');
    expect(label.children[0].tabIndex).toBe(-1);
    expect(label.children[0].attrs.switch).toBe('');
    expect(label.style.cssText).not.toMatch(/display:\s*none/);
    expect(label.style.cssText).toMatch(/position:fixed/);
  });
});

describe('haptics setting', () => {
  it('turns every call into nothing when off, and remembers it', () => {
    const nav = android();
    const doc = fakeDoc();
    const storage = memoryStorage();
    const engine = createHaptics({ nav, doc, storage });

    expect(engine.isOn()).toBe(true);
    engine.setOn(false);
    expect(storage.data['mnemoq-haptics']).toBe('0');

    for (const name of ['tap', 'select', 'correct', 'wrong', 'celebrate', 'error']) engine.haptic[name]();
    engine.haptic.charge(2);
    expect(nav.vibrate).not.toHaveBeenCalled();

    // A fresh start on the same device stays off.
    expect(createHaptics({ nav, storage }).isOn()).toBe(false);

    const ios = createHaptics({ nav: iphone(), doc, storage });
    ios.haptic.celebrate();
    expect(doc.clicks).toHaveLength(0);
  });

  it('carries over the Daily’s old switch once', () => {
    const storage = memoryStorage({ 'mnemoq-daily-sound': JSON.stringify({ sound: true, haptics: false }) });
    expect(createHaptics({ nav: android(), storage }).isOn()).toBe(false);
    expect(createHaptics({ nav: android(), storage: memoryStorage() }).isOn()).toBe(true);
  });

  it('notifies listeners so every screen shows the same switch', () => {
    const engine = createHaptics({ nav: android(), storage: memoryStorage() });
    const seen = vi.fn();
    const stop = engine.subscribe(seen);

    engine.setOn(false);
    stop();
    engine.setOn(true);
    expect(seen).toHaveBeenCalledTimes(1);
  });
});

describe('unsupported browsers', () => {
  it('never throw', () => {
    const throwing = {
      userAgent: UA.android,
      maxTouchPoints: 5,
      vibrate: () => {
        throw new Error('blocked');
      },
    };
    const brokenStorage = {
      getItem: () => {
        throw new Error('private mode');
      },
      setItem: () => {
        throw new Error('private mode');
      },
    };
    const envs = [
      {},
      { nav: null, doc: null, storage: null },
      { nav: { userAgent: UA.desktop, maxTouchPoints: 0 } },
      { nav: throwing, storage: brokenStorage },
      { nav: iphone(), doc: null },
      { nav: iphone(), doc: { body: null } },
    ];

    for (const env of envs) {
      const engine = createHaptics(env);
      expect(() => {
        for (const name of ['tap', 'select', 'correct', 'wrong', 'celebrate', 'error']) engine.haptic[name]();
        engine.haptic.charge(1);
        engine.setOn(false);
        engine.setOn(true);
      }).not.toThrow();
    }
  });
});
