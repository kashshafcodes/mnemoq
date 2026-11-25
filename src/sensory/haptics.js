// Haptic feedback for the whole app, with one on/off setting saved on this
// device (default on).
//
// - Android (Chrome, Samsung Internet, Firefox): navigator.vibrate(pattern).
// - iPhone and iPad: Safari has no Vibration API. Since iOS 18, toggling an
//   <input type="checkbox" switch> plays a light system tick, so we click a
//   hidden one. It only ticks during a user gesture, so the first tick always
//   runs synchronously inside the tap handler that called us.
// - Desktop, or anything else: nothing, and never an error.
//
// Use with restraint (see company/ops/briefs/haptics.md):
//   haptic.tap()       Play button and other primary actions
//   haptic.select()    picking an answer or a rating
//   haptic.correct()   a recall came back right
//   haptic.wrong()     a recall missed
//   haptic.celebrate() round done, "Done for today"
//   haptic.error()     a failed save or form error

// Moved here from src/haptics.js (which re-exports this file) for the sensory
// system. The on/off value is the Vibration switch of the one sensory store
// (settings.js), which migrates the old `mnemoq-haptics` key.

import { useSyncExternalStore } from 'react';
import { createSettings, settings as sharedSettings } from './settings.js';

// Android patterns, in ms: [buzz, pause, buzz, ...]. Kept short; long buzzes
// feel like a phone call. iosTicks is how many switch ticks iOS plays: one
// for everything, two only for a celebration.
export const PATTERNS = {
  // Spec phase2-sensory section 3. iosTicks 0 = no tick (flips, steps,
  // embers: they often arrive outside a tap, and a tick there feels random).
  tap: { android: 10, iosTicks: 1 },
  select: { android: 14, iosTicks: 1 },
  charge: { android: 12, iosTicks: 1 },
  charged: { android: [16, 40, 22], iosTicks: 1 },
  correct: { android: [14, 45, 24], iosTicks: 1 },
  wrong: { android: [36, 50, 36], iosTicks: 1 },
  celebrate: { android: [18, 60, 18, 60, 40], iosTicks: 2 },
  error: { android: [50, 60, 50], iosTicks: 1 },
  almost: { android: [12, 70, 12], iosTicks: 1 },
  flip: { android: 8, iosTicks: 0 },
  reveal: { android: 10, iosTicks: 0 },
  stepDone: { android: [14, 46, 14], iosTicks: 0 },
  roundDone: { android: [16, 74, 16, 74, 40], iosTicks: 2 },
  ember: { android: 30, iosTicks: 0 },
  levelUp: { android: [20, 50, 20, 50, 20, 50, 60], iosTicks: 2 },
  milestone: { android: [24, 60, 24, 60, 24, 120, 70], iosTicks: 2 },
  snapShutter: { android: 14, iosTicks: 1 },
  snapMade: { android: [14, 46, 14, 46, 30], iosTicks: 0 },
  toggle: { android: 10, iosTicks: 1 },
};

// Reduced motion (spec D7): a celebration shrinks to one short pair.
export const REDUCED_CELEBRATION = [18, 60, 20];

// The device check may find the vibration lands late or early against the
// sound; this shifts it (spec 1.5). 0 until a real phone says otherwise.
export const HAPTIC_LEAD_MS = 0;

// Gap between the two iOS ticks of a celebration. The second tick runs in a
// timeout, so it only plays if WebKit still counts the tap as recent.
const IOS_TICK_GAP = 140;

// 'ios' | 'vibrate' | 'none'. iPadOS says it is a Mac, so a "Mac" with a
// touch screen is an iPad. Desktop Chrome has navigator.vibrate but no motor,
// so vibrate only counts on a touch device.
export function detectPlatform(nav) {
  if (!nav) return 'none';

  const ua = String(nav.userAgent || '');
  const touch = Number(nav.maxTouchPoints) || 0;
  const hasVibrate = typeof nav.vibrate === 'function';
  const ios = /iP(hone|ad|od)/.test(ua) || (/Mac/.test(String(nav.platform || ua)) && touch > 1);

  if (hasVibrate && (touch > 0 || /Android/i.test(ua))) return 'vibrate';
  if (ios) return 'ios';
  return 'none';
}

// A haptics engine. The app uses the default one below; tests build their own
// with a fake navigator, document and storage.
export function createHaptics({ nav, doc, storage, settings, schedule = (fn, ms) => setTimeout(fn, ms) } = {}) {
  const store = settings || createSettings({ storage });
  const isOn = () => store.get().vibration;
  let iosSwitch = null;

  function iosTick() {
    if (!doc?.body) return;

    if (!iosSwitch || !iosSwitch.isConnected) {
      const label = doc.createElement('label');
      const input = doc.createElement('input');

      input.type = 'checkbox';
      input.setAttribute('switch', '');
      input.tabIndex = -1;
      label.setAttribute('aria-hidden', 'true');
      label.setAttribute('data-haptics', '');
      // Invisible and out of the layout, but still rendered and clickable:
      // WebKit skips the tick for display:none or visibility:hidden.
      label.style.cssText =
        'position:fixed;left:0;top:0;width:1px;height:1px;margin:0;padding:0;overflow:hidden;opacity:0;clip-path:inset(50%);pointer-events:none;z-index:-1;';
      label.appendChild(input);
      // Keep these clicks to ourselves, so "click outside to close" menus
      // never see them. (This does not stop the switch from toggling.)
      label.addEventListener('click', (event) => event.stopPropagation());
      doc.body.appendChild(label);
      iosSwitch = label;
    }

    // Clicking a label can move focus to its checkbox; put it back, so a
    // text box keeps its keyboard and keyboard users keep their place.
    const before = doc.activeElement;

    iosSwitch.click();

    if (doc.activeElement !== before) {
      if (before && before !== doc.body && typeof before.focus === 'function') before.focus({ preventScroll: true });
      else doc.activeElement?.blur?.();
    }
  }

  function play(name, { reduced = false } = {}) {
    if (!isOn()) return;

    try {
      const platform = detectPlatform(nav);
      const pattern = PATTERNS[name];

      if (!pattern || platform === 'none') return;

      const celebration = Array.isArray(pattern.android) && pattern.android.length > 3;

      if (platform === 'vibrate') {
        // Chrome blocks (and logs) vibrate before the first tap on the page.
        if (nav.userActivation && !nav.userActivation.hasBeenActive) return;
        nav.vibrate(reduced && celebration ? REDUCED_CELEBRATION : pattern.android);
        return;
      }

      if (!pattern.iosTicks) return;
      iosTick();
      const ticks = reduced ? 1 : pattern.iosTicks;
      for (let i = 1; i < ticks; i += 1) {
        schedule(() => {
          try {
            iosTick();
          } catch {
            // Never let haptics break anything.
          }
        }, i * IOS_TICK_GAP);
      }
    } catch {
      // Never let haptics break anything.
    }
  }

  const haptic = {
    tap: () => play('tap'),
    select: () => play('select'),
    charge: (level) => play(level === 3 ? 'charged' : 'charge'),
    correct: () => play('correct'),
    wrong: () => play('wrong'),
    celebrate: () => play('celebrate'),
    error: () => play('error'),
  };

  return {
    haptic,
    play,
    platform: () => detectPlatform(nav),
    isOn,
    setOn: (next) => store.set({ vibration: Boolean(next) }),
    subscribe: (fn) => store.subscribe(() => fn()),
  };
}

const engine = createHaptics({
  nav: typeof navigator === 'undefined' ? null : navigator,
  doc: typeof document === 'undefined' ? null : document,
  settings: sharedSettings,
});

export const playHaptic = engine.play;

export const haptic = engine.haptic;
export const hapticsPlatform = engine.platform;
export const hapticsOn = engine.isOn;
export const setHapticsOn = engine.setOn;

// [on, setOn] for a React switch. Every screen sees the same value.
export function useHapticsSetting() {
  const on = useSyncExternalStore(engine.subscribe, engine.isOn, engine.isOn);
  return [on, engine.setOn];
}
