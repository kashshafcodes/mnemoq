// Who has Mnemoq Pro. Shared by the server functions that guard Pro features.
//
// A person is Pro when their row in user_plans (supabase/stage5.sql) has a
// pro_until date in the future, or when their verified email is listed in
// PRO_EMAILS (comma-separated; meant for the site owner and testers).

export function listedAsPro(env, user) {
  const email = String(user?.email || '').trim().toLowerCase();
  const verified = Boolean(user?.email_confirmed_at || user?.confirmed_at);

  if (!email || !verified) return false;

  return String(env.PRO_EMAILS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(email);
}

export function isActive(proUntil, now = new Date()) {
  const until = proUntil ? new Date(proUntil).getTime() : NaN;

  return Number.isFinite(until) && until > now.getTime();
}

// Reads the person's own plan row with their own token (row level security
// means they can only ever see their own). Any failure counts as "not Pro".
export async function hasPro(env, cfg, token, user) {
  if (listedAsPro(env, user)) return true;

  try {
    const res = await fetch(`${cfg.url}/rest/v1/user_plans?select=pro_until&limit=1`, {
      headers: { apikey: cfg.key, Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return false;

    const rows = await res.json().catch(() => null);

    return Array.isArray(rows) && rows.length > 0 && isActive(rows[0].pro_until);
  } catch {
    return false;
  }
}
