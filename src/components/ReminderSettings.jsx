import { useEffect, useState } from 'react';
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
import AiBadge from './AiBadge';

// The "Reminders" card on the profile page.

export default function ReminderSettings({ userId }) {
  const [state, setState] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState({ text: '', error: false });
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

  const say = (text, error = false) => setMessage({ text, error });

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

    say('Reminders are on. Tap "Send a test" to see one now.');
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

  async function save(event) {
    event.preventDefault();
    setBusy(true);

    const saved = await saveReminderSettings(userId, settings);

    setBusy(false);
    say(saved.error || 'Saved.', Boolean(saved.error));
  }

  async function test() {
    setBusy(true);
    say('');

    const result = await sendTestReminder();

    setBusy(false);
    say(result.error || 'Test sent. It should arrive in a moment.', Boolean(result.error));
  }

  if (!state) return <section className="profile-card"><h3>Reminders</h3><p className="path-hint">Loading...</p></section>;

  const on = state.settings.enabled && state.thisDevice;

  return (
    <section className="profile-card reminders">
      <h3>
        Reminders <AiBadge>Smart</AiBadge>
      </h3>
      <p className="path-hint">
        Spaced repetition only works if you come back at the right time. Mnemoq nudges you when cards are due, and only
        when there is something to review.
      </p>

      {state.setup && (
        <p className="qa-message qa-error" role="alert">
          Reminders need a one-time server update. If you run this site, run <code>supabase/stage4.sql</code> in Supabase.
        </p>
      )}

      {!state.setup && !supported && (
        <p className="path-hint">
          This browser cannot show reminders.{' '}
          {iosNeedsInstall
            ? 'On iPhone, tap the Share button, choose Add to Home Screen, then open Mnemoq from your Home Screen.'
            : 'Try Chrome, Edge or Firefox, or install Mnemoq on your phone.'}
        </p>
      )}

      {!state.setup && supported && iosNeedsInstall && (
        <p className="path-hint">
          On iPhone, reminders work after you tap Share, choose Add to Home Screen and open Mnemoq from your Home Screen.
        </p>
      )}

      {!state.setup && supported && serverKeyMissing() && (
        <p className="path-hint">
          The site is missing its reminder key (<code>VITE_VAPID_PUBLIC_KEY</code>), so reminders cannot start yet. If you run this
          site, add it in Vercel and redeploy.
        </p>
      )}

      {!state.setup && supported && !on && (
        <div className="reminder-actions">
          {state.permission === 'denied' ? (
            <p className="path-hint">Notifications are blocked for this site. Allow them in your browser settings, then reload.</p>
          ) : (
            <button type="button" className="qa-primary" disabled={busy} onClick={turnOn}>
              {busy ? 'Turning on...' : state.settings.enabled ? 'Turn on for this device' : 'Turn on reminders'}
            </button>
          )}
        </div>
      )}

      {!state.setup && supported && on && (
        <form className="reminder-form" onSubmit={save}>
          <label htmlFor="remind-time">Remind me every day at</label>
          <input id="remind-time" type="time" value={settings.time} onChange={(e) => setSettings({ ...settings, time: e.target.value || '18:00' })} />
          <label className="reminder-check">
            <input type="checkbox" checked={settings.streakNudge} onChange={(e) => setSettings({ ...settings, streakNudge: e.target.checked })} />
            <span>Also nudge me in the evening if my streak is about to end</span>
          </label>
          <label className="reminder-check">
            <input type="checkbox" checked={settings.dueAlerts} onChange={(e) => setSettings({ ...settings, dueAlerts: e.target.checked })} />
            <span>Alert me during the day when cards are due (at most 3 a day, never in quiet hours)</span>
          </label>
          {settings.dueAlerts && (
            <div className="reminder-sub">
              <label htmlFor="due-min">Only when at least</label>
              <select id="due-min" value={settings.dueMin} onChange={(e) => setSettings({ ...settings, dueMin: Number(e.target.value) })}>
                {[1, 3, 5, 10, 20].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'card is' : 'cards are'} due
                  </option>
                ))}
              </select>
              <label htmlFor="quiet-start">Quiet hours (no alerts)</label>
              <div className="reminder-quiet">
                <input id="quiet-start" type="time" value={settings.quietStart} onChange={(e) => setSettings({ ...settings, quietStart: e.target.value || '22:00' })} />
                <span>to</span>
                <input id="quiet-end" type="time" aria-label="Quiet hours end" value={settings.quietEnd} onChange={(e) => setSettings({ ...settings, quietEnd: e.target.value || '07:00' })} />
              </div>
            </div>
          )}
          <div className="reminder-actions">
            <button type="submit" className="qa-primary" disabled={busy}>
              Save
            </button>
            <button type="button" className="ghost-button" disabled={busy} onClick={test}>
              Send a test
            </button>
            <button type="button" className="text-link" disabled={busy} onClick={turnOff}>
              Turn off
            </button>
          </div>
        </form>
      )}

      {message.text && (
        <p className={message.error ? 'qa-message qa-error' : 'path-hint'} role="status">
          {message.text}
        </p>
      )}
    </section>
  );
}
