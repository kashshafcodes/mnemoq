import AiBadge from './AiBadge';
import { pageHref } from '../useRoute';

// "Today" card (daily missions) and the achievements list for an exam path.

export function MissionsCard({ plan, streak, onStartDiagnostic, onReviewSubject, canReview }) {
  function act(mission) {
    const { type, subject } = mission.action;

    if (type === 'diagnostic') onStartDiagnostic();
    else if (type === 'subject' && canReview(subject)) onReviewSubject(subject);
    else window.location.hash = pageHref(type === 'add' ? 'add' : 'review').slice(1);
  }

  return (
    <section className="path-card missions">
      <header>
        <h3>
          Today's missions <AiBadge />
        </h3>
        <p>
          {plan.allDone
            ? 'All done for today. Come back tomorrow to keep your streak.'
            : `${plan.done} of ${plan.total} done · aimed at your weakest section`}
          {streak > 0 && ` · ${streak}-day streak`}
        </p>
      </header>
      <ul className="mission-list">
        {plan.missions.map((m) => (
          <li key={m.id} className={m.done ? 'mission done' : 'mission'}>
            <span className="mission-check" aria-hidden="true">
              {m.done ? '✓' : ''}
            </span>
            <div className="mission-body">
              <strong>{m.title}</strong>
              <p>{m.detail}</p>
              <div className="path-meter small" aria-hidden="true">
                <span className={m.done ? 'good' : ''} style={{ width: `${(m.value / m.goal) * 100}%` }} />
              </div>
              <small>
                {m.value} of {m.goal}
              </small>
            </div>
            {!m.done && (
              <button type="button" className="ghost-button" onClick={() => act(m)}>
                {m.action.label}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AchievementsCard({ items }) {
  const unlocked = items.filter((a) => a.unlocked).length;

  return (
    <section className="path-card">
      <header>
        <h3>Achievements</h3>
        <p>
          {unlocked} of {items.length} unlocked
        </p>
      </header>
      <ul className="ach-grid">
        {items.map((a) => (
          <li key={a.id} className={a.unlocked ? 'ach unlocked' : 'ach'}>
            <span className="ach-icon" aria-hidden="true">
              {a.unlocked ? '★' : '☆'}
            </span>
            <strong>{a.title}</strong>
            <p>{a.detail}</p>
            {!a.unlocked && (
              <small>
                {a.value} of {a.goal}
              </small>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
