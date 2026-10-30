import { useMemo, useState } from 'react';
import { computeAnalytics } from '../analytics';
import { AVATAR_COLORS, NAME_MAX, cleanName, readProfile } from '../profile';
import { LanguageToggle } from '../i18n';
import { Badges } from './Dashboard';
import { NO_SUGGEST } from '../noSuggest';

// The person's own page: who they are, how they're doing, and their settings.

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function Avatar({ profile, size = 40 }) {
  return (
    <span
      className="avatar-badge"
      style={{ '--avatar': profile.color.value, width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {profile.initial}
    </span>
  );
}

export default function Profile({ user, cards, reviews, onSave, onLogout, onTutorial }) {
  const profile = readProfile(user);
  const data = useMemo(() => computeAnalytics(cards, reviews, new Date()), [cards, reviews]);
  const { stats } = data;

  const [name, setName] = useState(profile.name);
  const [colorId, setColorId] = useState(profile.color.id);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', error: false });

  const changed = cleanName(name) !== profile.name || colorId !== profile.color.id;
  const preview = readProfile({
    ...user,
    user_metadata: { ...user?.user_metadata, display_name: name, avatar_color: colorId },
  });

  async function handleSave(event) {
    event.preventDefault();

    if (saving || !changed) return;

    setSaving(true);
    setMessage({ text: '', error: false });

    const result = await onSave({ name: cleanName(name), color: colorId });

    setSaving(false);

    if (result?.error) {
      setMessage({ text: `Could not save: ${result.error}`, error: true });
    } else {
      setName(cleanName(name));
      setMessage({ text: 'Saved.', error: false });
    }
  }

  const since = profile.since
    ? profile.since.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="profile">
      <section className="profile-card profile-head">
        <Avatar profile={preview} size={72} />
        <div className="profile-who">
          <h2>{preview.shown}</h2>
          {profile.email && <p className="profile-email">{profile.email}</p>}
          <p className="profile-meta">
            {since ? `Member since ${since}` : 'Member'}
            {stats.daysLearning > 0 && ` · ${plural(stats.daysLearning, 'day')} of learning`}
          </p>
        </div>
      </section>

      <section className="profile-card">
        <h3>Your details</h3>
        <form className="profile-form" onSubmit={handleSave}>
          <label htmlFor="profile-name">
            Display name <span className="optional">(shown on leaderboards later)</span>
          </label>
          <input
            id="profile-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setMessage({ text: '', error: false });
            }}
            maxLength={NAME_MAX}
            placeholder={profile.email.split('@')[0] || 'Your name'}
            {...NO_SUGGEST}
          />

          <p className="profile-label" id="profile-color-label">Avatar colour</p>
          <div className="profile-colors" role="radiogroup" aria-labelledby="profile-color-label">
            {AVATAR_COLORS.map((color) => (
              <button
                key={color.id}
                type="button"
                role="radio"
                aria-checked={colorId === color.id}
                aria-label={color.label}
                className={colorId === color.id ? 'profile-swatch selected' : 'profile-swatch'}
                style={{ '--swatch': color.value }}
                onClick={() => {
                  setColorId(color.id);
                  setMessage({ text: '', error: false });
                }}
              />
            ))}
          </div>

          <div className="profile-actions">
            <button type="submit" className="qa-primary" disabled={saving || !changed}>
              {saving ? 'Saving...' : 'Save changes'}
            </button>
            {message.text && (
              <span className={message.error ? 'profile-note error' : 'profile-note'} role="status">
                {message.text}
              </span>
            )}
          </div>
        </form>
      </section>

      <section className="profile-card">
        <h3>Your numbers</h3>
        <dl className="profile-stats">
          <div>
            <dt>Cards</dt>
            <dd>{stats.totalCards}</dd>
          </div>
          <div>
            <dt>Reviews</dt>
            <dd>{stats.reviewsTotal}</dd>
          </div>
          <div>
            <dt>Mastered</dt>
            <dd>{stats.mastered}</dd>
          </div>
          <div>
            <dt>Current streak</dt>
            <dd>{stats.streak.current}</dd>
          </div>
          <div>
            <dt>Best streak</dt>
            <dd>{stats.streak.best}</dd>
          </div>
          <div>
            <dt>Recall rate</dt>
            <dd>{stats.recallRate === null ? '–' : `${Math.round(stats.recallRate * 100)}%`}</dd>
          </div>
        </dl>
      </section>

      <section className="profile-card">
        <h3>Badges</h3>
        <Badges badges={data.badges} />
      </section>

      <section className="profile-card">
        <h3>Settings</h3>
        <div className="profile-settings">
          <div className="profile-row">
            <span>Language</span>
            <LanguageToggle />
          </div>
          <div className="profile-row">
            <span>New here?</span>
            <button type="button" className="text-link" onClick={onTutorial}>
              See how Mnemoq works
            </button>
          </div>
          <div className="profile-row">
            <span>Signed in as {profile.email || 'you'}</span>
            <button type="button" className="ghost-button" onClick={onLogout}>
              Log out
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
