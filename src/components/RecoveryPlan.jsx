import { useI18n } from '../i18n';
import { isLockedIn, planDates } from '../pilot';

// Kept apart from Pilot.jsx so Home can show it without loading the whole
// first-run debrief (Pilot loads on demand).

function formatDate(date, locale) {
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

// ---------------------------------------------------------------------------
// Recovery Plan card for the dashboard (return checkpoints)
// ---------------------------------------------------------------------------
export function RecoveryPlan({ pilot, cards, onHide, onReview, dueCount }) {
  const { t, locale } = useI18n();
  const mine = pilot.cardIds
    .map((id) => cards.find((card) => card.id === id))
    .filter(Boolean);

  if (mine.length === 0) return null;

  const lockedIn = mine.filter(isLockedIn).length;
  const now = new Date();
  const dates = planDates(pilot.startedAt, pilot.examDate ? `${pilot.examDate}T00:00:00` : null);
  const complete = lockedIn === mine.length;

  return (
    <section className="recovery-plan" aria-labelledby="recovery-plan-title">
      <div className="recovery-plan-head">
        <div>
          <p className="eyebrow">{t('plan.eyebrow')}</p>
          <h2 id="recovery-plan-title">
            {complete ? t('plan.complete', { n: mine.length }) : t('plan.title', { k: lockedIn, n: mine.length })}
          </h2>
          <p className="pilot-muted">{t('plan.sub')}</p>
        </div>
        <button type="button" className="pilot-link" onClick={onHide}>{t('plan.hide')}</button>
      </div>

      <div className="recovery-bar" role="progressbar" aria-valuemin={0} aria-valuemax={mine.length} aria-valuenow={lockedIn}>
        <span style={{ width: `${(lockedIn / mine.length) * 100}%` }} />
      </div>

      <ol className="pilot-timeline pilot-timeline-compact" aria-label={t('plan.checkpoint')}>
        {dates.map((item, index) => {
          const next = dates[index + 1];
          const state = now >= item.date && (!next || now < next.date) ? 'current' : now >= item.date ? 'past' : 'future';

          return (
            <li key={item.key} className={`pilot-${state}`}>
              <span className="pilot-dot" />
              <strong>{t(item.label)}</strong>
              <span className="pilot-muted">{formatDate(item.date, locale)}</span>
            </li>
          );
        })}
      </ol>

      {dueCount > 0 && !complete && (
        <button type="button" className="primary-button" onClick={onReview}>
          {t('plan.reviewDue')}
        </button>
      )}
    </section>
  );
}

