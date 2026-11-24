import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  isInstalledApp,
  isIos,
  loadReminderState,
  pushSupported,
  saveReminderSettings,
  sendTestReminder,
  serverKeyMissing,
  subscribeThisDevice,
  unsubscribeThisDevice,
} from '../reminders';
import { trackEvent } from '../googleAnalytics';

// The "Reminders" card on the profile page. One switch and one time; the smart
// parts (alerts when cards pile up, the evening streak nudge, quiet hours at
// night) work on their own with sensible defaults.

const TIMES = [
  ['07:00', 'Morning, 7 am'],
  ['13:00', 'Afternoon, 1 pm'],
  ['18:00', 'Early evening, 6 pm'],
  ['19:00', 'Evening, 7 pm'],
  ['21:00', 'Night, 9 pm'],
];

const label = (time) => TIMES.find(([t]) => t === time)?.[1] || time;

export default function ReminderSettings({ userId }) {
  const [state, setState] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ text: '', error: false });
  const saveTimer = useRef(null);
  const supported = pushSupported();
  const iosNeedsInstall = isIos() && !isInstalledApp();

  async function refresh() {
    const next = await loadReminderState(userId);

    setState(next);
    setSettings(next.settings);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Arriving from the home page's "Turn on" button: bring this card into view.
  useEffect(() => {
    if (state && /reminders/.test(window.location.hash)) {
      document.getElementById('reminders')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [state]);

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const say = (text, error = false) => setMessage({ text, error });
  const on = Boolean(state?.settings.enabled && state?.thisDevice);

  async function turnOn() {
    setBusy(true);
    say('');

    const device = await subscribeThisDevice(userId);

    if (device.error) {
      setBusy(false);
      say(device.error, true);
      return;
    }

    const saved = await saveReminderSettings(userId, { ...settings, enabled: true }, { justEnabled: true });

    setBusy(false);

    if (saved.error) {
      say(saved.error, true);
      return;
    }

    trackEvent('reminders_on');
    say(`Done. You will get a reminder around ${label(settings.time).toLowerCase()} when cards are due.`);
    await refresh();
  }

  async function turnOff() {
    setBusy(true);
    await unsubscribeThisDevice();
    await saveReminderSettings(userId, { ...settings, enabled: false });
    setBusy(false);
    say('Reminders are off.');
    await refresh();
  }

  // Changes save by themselves, a moment after the last tap.
  function change(patch) {
    const next = { ...settings, ...patch };

    setSettings(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const saved = await saveReminderSettings(userId, next);

      say(saved.error || 'Saved.', Boolean(saved.error));
    }, 500);
  }

  async function test() {
    setBusy(true);
    say('');

    const result = await sendTestReminder();

    setBusy(false);
    say(result.error || 'Sent. It should arrive in a few seconds.', Boolean(result.error));
  }

  if (!state) {
    return (
      <section className="profile-card rm" id="reminders">
        <h3>Reminders</h3>
        <p className="rm-muted">Loading…</p>
      </section>
    );
  }

  const blocker = state.setup
    ? 'Reminders are not switched on for this site yet.'
    : !supported
      ? iosNeedsInstall
        ? 'On iPhone: tap Share, then "Add to Home Screen", and open Mnemoq from there. Then come back here.'
        : 'This browser cannot show reminders. Try Chrome on your phone.'
      : serverKeyMissing()
        ? 'Reminders are not switched on for this site yet.'
        : state.permission === 'denied'
          ? 'Notifications are blocked for Mnemoq. Allow them in your browser settings, then reload this page.'
          : '';

  return (
    <section className="profile-card rm" id="reminders">
      <div className="rm-head">
        <div>
          <h3>Reminders</h3>
          <p className="rm-muted">We remind you only when cards are due, never for nothing.</p>
        </div>
        {!blocker && (
          <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label="Reminders"
            className={on ? 'rm-switch on' : 'rm-switch'}
            disabled={busy}
            onClick={on ? turnOff : turnOn}
          >
            <span />
          </button>
        )}
      </div>

      {blocker && <p className="rm-note">{blocker}</p>}

      {!blocker && on && (
        <>
          <p className="rm-label">What time suits you?</p>
          <div className="rm-times" role="radiogroup" aria-label="Reminder time">
            {TIMES.map(([time, text]) => (
              <button
                key={time}
                type="button"
                role="radio"
                aria-checked={settings.time === time}
                className={settings.time === time ? 'active' : ''}
                onClick={() => change({ time })}
              >
                {text}
              </button>
            ))}
          </div>

          <details className="rm-more">
            <summary>More</summary>
            <label className="rm-check">
              <input type="checkbox" checked={settings.dueAlerts} onChange={(e) => change({ dueAlerts: e.target.checked })} />
              <span>Also tell me when lots of cards pile up during the day</span>
            </label>
            <label className="rm-check">
              <input type="checkbox" checked={settings.streakNudge} onChange={(e) => change({ streakNudge: e.target.checked })} />
              <span>Nudge me at 8 pm if my streak is about to end</span>
            </label>
            <p className="rm-muted">We never send anything between 10 pm and 7 am, at most a few a day.</p>
            <button type="button" className="text-link" disabled={busy} onClick={test}>
              Send me a test reminder
            </button>
          </details>
        </>
      )}

      {!blocker && !on && !message.text && <p className="rm-muted">Turn on to get a nudge on this phone when it is time to review.</p>}

      {message.text && (
        <p className={message.error ? 'qa-message qa-error' : 'rm-ok'} role="status">
          {message.text}
        </p>
      )}
    </section>
  );
}
