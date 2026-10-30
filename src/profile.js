// The person's public-facing profile: a display name and an avatar colour.
// Both are saved on the account itself (Supabase "user metadata"), so they
// follow the person to every device and no database table is needed.

export const AVATAR_COLORS = [
  { id: 'violet', value: '#8b5cf6', label: 'Violet' },
  { id: 'blue', value: '#3b82f6', label: 'Blue' },
  { id: 'teal', value: '#14b8a6', label: 'Teal' },
  { id: 'green', value: '#22c55e', label: 'Green' },
  { id: 'amber', value: '#f59e0b', label: 'Amber' },
  { id: 'rose', value: '#f43f5e', label: 'Rose' },
];

export const NAME_MAX = 40;

// Collapses spaces and control characters; the name is shown to other people
// later (leaderboards), so keep it plain text.
export function cleanName(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX);
}

export function readProfile(user) {
  const meta = user?.user_metadata || {};
  const email = String(user?.email || '');
  const name = cleanName(meta.display_name);
  const color = AVATAR_COLORS.find((c) => c.id === meta.avatar_color) || AVATAR_COLORS[0];
  const shown = name || email.split('@')[0] || 'You';

  return {
    name, // empty when the person hasn't set one
    shown, // what to display: the name, or the start of their email
    email,
    color,
    initial: Array.from(shown)[0]?.toLocaleUpperCase() || 'M',
    since: user?.created_at ? new Date(user.created_at) : null,
  };
}
