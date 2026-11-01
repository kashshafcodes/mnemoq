import { supabase } from './supabaseClient';

// Review reminders: browser / phone push notifications.
// Settings and devices live in Supabase (supabase/stage4.sql); the server sends
// them on schedule (api/remind.js).

export const DEFAULT_SETTINGS = { enabled: false, time: '18:00', streakNudge: true, dueAlerts: true, dueMin: 5, quietStart: '22:00', quietEnd: '07:00' };

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

const missingTable = (error) =>
  Boolean(error && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message || '')));

export const deviceTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isInstalledApp = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

export const serverKeyMissing = () => !PUBLIC_KEY;

function keyBytes(base64Url) {
  const padded = base64Url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64Url.length / 4) * 4, '=');
  const raw = atob(padded);

  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const localDate = (timeZone) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

async function currentSubscription() {
  if (!pushSupported()) return null;

  const registration = await navigator.serviceWorker.getRegistration('/sw.js');

  return registration ? registration.pushManager.getSubscription() : null;
}

// -> { setup: boolean, settings, thisDevice: boolean, permission }
export async function loadReminderState(userId) {
  const { data, error } = await supabase.from('reminder_settings').select('*').eq('user_id', userId).maybeSingle();

  if (missingTable(error)) return { setup: true, settings: DEFAULT_SETTINGS, thisDevice: false, permission: 'default' };

  const settings = data
    ? {
        enabled: data.enabled,
        time: data.remind_time,
        streakNudge: data.streak_nudge,
        dueAlerts: data.due_alerts ?? true,
        dueMin: data.due_min ?? 5,
        quietStart: data.quiet_start || '22:00',
        quietEnd: data.quiet_end || '07:00',
      }
    : DEFAULT_SETTINGS;
  const subscription = await currentSubscription().catch(() => null);

  return {
    setup: false,
    settings,
    thisDevice: Boolean(subscription),
    permission: pushSupported() ? Notification.permission : 'denied',
  };
}

export async function saveReminderSettings(userId, settings, { justEnabled = false } = {}) {
  const timezone = deviceTimeZone();
  const row = {
    user_id: userId,
    enabled: settings.enabled,
    remind_time: settings.time,
    timezone,
    streak_nudge: settings.streakNudge,
    due_alerts: settings.dueAlerts,
    due_min: settings.dueMin,
    quiet_start: settings.quietStart,
    quiet_end: settings.quietEnd,
    updated_at: new Date().toISOString(),
  };

  // Turning reminders on after today's time has passed should not fire at once.
  if (justEnabled) row.last_sent_on = localDate(timezone);

  const { error } = await supabase.from('reminder_settings').upsert(row, { onConflict: 'user_id' });

  if (missingTable(error)) return { error: 'Reminders need a one-time server update (run supabase/stage4.sql).' };

  return { error: error ? error.message : '' };
}

// Registers this device. Returns { error } with a message the person can read.
export async function subscribeThisDevice(userId) {
  if (!pushSupported()) return { error: 'This browser cannot receive reminders.' };
  if (!PUBLIC_KEY) return { error: 'Reminders are not set up on the server yet.' };

  const permission = await Notification.requestPermission();

  if (permission !== 'granted') {
    return { error: 'Notifications are blocked. Allow them for this site in your browser settings, then try again.' };
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');

    await navigator.serviceWorker.ready;

    const subscription =
      (await registration.pushManager.getSubscription()) ||
      (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) }));
    const json = subscription.toJSON();
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
        user_agent: (navigator.userAgent || '').slice(0, 200),
      },
      { onConflict: 'endpoint' }
    );

    if (missingTable(error)) return { error: 'Reminders need a one-time server update (run supabase/stage4.sql).' };

    return { error: error ? error.message : '' };
  } catch (caught) {
    return { error: `Could not turn on reminders on this device (${caught?.message || 'unknown error'}).` };
  }
}

export async function unsubscribeThisDevice() {
  const subscription = await currentSubscription().catch(() => null);

  if (!subscription) return;

  const endpoint = subscription.endpoint;

  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  await subscription.unsubscribe().catch(() => {});
}

export async function sendTestReminder() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  if (!token) return { error: 'Please log in again.' };

  try {
    const response = await fetch('/api/push-test', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const json = await response.json().catch(() => null);

    if (!json) return { error: 'Reminders are not available yet. If the site was just updated, try again in a minute.' };
    if (!response.ok) return { error: json.error || 'The test could not be sent.' };

    return { error: '' };
  } catch {
    return { error: 'Could not reach the server. Check your connection.' };
  }
}
