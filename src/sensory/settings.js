// One store for the three sensory switches: Sound, Music and Vibration,
// saved on this device under `mnemoq-sensory`.
//
// Defaults (owner, 26 Nov): Sound on, Music on (quiet, and only after the
// first tap, only in Today's round and the Daily), Vibration on.
//
// Migration, once: the Daily kept { sound, music, haptics } under
// `mnemoq-daily-sound`, and haptics.js kept '1'/'0' under `mnemoq-haptics`.
// Sound and Vibration carry over. Music does not: the Daily saved
// `music: false` as its default whenever any switch was touched, so an old
// "false" is not a choice, and the owner's default (on) wins.
// The Vibration value is still mirrored to `mnemoq-haptics`, so an older
// cached app version on the same phone reads the same answer.

export const SENSORY_KEY = 'mnemoq-sensory';
export const OLD_HAPTICS_KEY = 'mnemoq-haptics';
export const OLD_DAILY_KEY = 'mnemoq-daily-sound';
export const DEFAULTS = Object.freeze({ sound: true, music: true, vibration: true });

const pick = (value, fallback) => (typeof value === 'boolean' ? value : fallback);

function parse(raw) {
  try {
    const value = JSON.parse(raw || 'null');

    return value && typeof value === 'object' ? value : null;
  } catch {
    return null;
  }
}

export function readSettings(storage) {
  let saved = null;
  let oldDaily = null;
  let oldHaptics = null;

  try {
    saved = parse(storage?.getItem(SENSORY_KEY));
    if (!saved) {
      oldDaily = parse(storage?.getItem(OLD_DAILY_KEY)) || {};
      oldHaptics = storage?.getItem(OLD_HAPTICS_KEY);
    }
  } catch {
    return { ...DEFAULTS };
  }

  if (saved) {
    return {
      sound: pick(saved.sound, DEFAULTS.sound),
      music: pick(saved.music, DEFAULTS.music),
      vibration: pick(saved.vibration, DEFAULTS.vibration),
    };
  }

  const vibration = oldHaptics === '1' ? true : oldHaptics === '0' ? false : oldDaily.haptics !== false;

  return { sound: oldDaily.sound !== false, music: DEFAULTS.music, vibration };
}

export function createSettings({ storage } = {}) {
  let state = readSettings(storage);
  const listeners = new Set();

  function save() {
    try {
      storage?.setItem(SENSORY_KEY, JSON.stringify(state));
      storage?.setItem(OLD_HAPTICS_KEY, state.vibration ? '1' : '0');
    } catch {
      // Not remembered; fine.
    }
  }

  return {
    get: () => state,
    set(patch) {
      const next = { ...state };

      for (const key of Object.keys(DEFAULTS)) if (typeof patch?.[key] === 'boolean') next[key] = patch[key];
      if (next.sound === state.sound && next.music === state.music && next.vibration === state.vibration) return;
      state = next;
      save();
      listeners.forEach((fn) => fn(state));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export function safeStorage() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

// The app's one store. Tests build their own with createSettings().
export const settings = createSettings({ storage: safeStorage() });
