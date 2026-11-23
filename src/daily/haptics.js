// Haptic feedback. Android browsers support navigator.vibrate. iPhone Safari
// does not, but since iOS 18 toggling an <input type="checkbox" switch> gives a
// light system tap, so on iOS we flip a hidden one. Both only work during a tap
// or key press, which is when we call them.

let enabled = true;
let iosSwitch = null;

export function setHapticsOn(on) {
  enabled = on;
}

function iosTap() {
  if (!iosSwitch) {
    const label = document.createElement('label');
    const input = document.createElement('input');

    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;';
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitch = label;
  }

  iosSwitch.click();
}

const isIOS = typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent);

function buzz(pattern) {
  if (!enabled || typeof navigator === 'undefined') return;

  try {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    } else if (isIOS) {
      // One switch flip per pulse; the gaps are approximated with timeouts.
      const pulses = Array.isArray(pattern) ? pattern.filter((_, i) => i % 2 === 0).length : 1;

      for (let i = 0; i < Math.min(pulses, 3); i += 1) setTimeout(iosTap, i * 90);
    }
  } catch {
    // Never let haptics break the game.
  }
}

export const haptic = {
  tap: () => buzz(8),
  select: () => buzz(12),
  charge: (level) => buzz(level === 3 ? [18, 30, 18] : 14),
  correct: () => buzz([14, 50, 22]),
  wrong: () => buzz([45, 40, 45]),
  celebrate: () => buzz([20, 60, 20, 60, 40]),
};
