import { useEffect } from 'react';
import Jonaki from './Jonaki';
import { noteRoundDone } from '../install/runtime';
import { subjectAccent } from '../subjects';
import { afterRound } from '../loop/playState';
import { useLoopT } from '../loop/strings';

// One tab per subject, plus "All". Each shows how many cards are due.
// Hidden when there is only one subject, since there is nothing to choose.
export function ReviewSubjectTabs({ tabs, active, totalDue, onChange }) {
  if (tabs.length < 2) return null;

  return (
    <div className="review-tabs" role="group" aria-label="Review subject">
      <button
        type="button"
        className="review-tab"
        aria-pressed={active === null}
        onClick={() => onChange(null)}
      >
        All
        <span className="review-tab-count">{totalDue}</span>
      </button>
      {tabs.map((tab) => (
        <button
          key={tab.name}
          type="button"
          className="review-tab"
          style={{ '--subject': subjectAccent(tab.name) }}
          aria-pressed={active === tab.name}
          onClick={() => onChange(tab.name)}
        >
          <span className="subject-dot" aria-hidden="true" />
          {tab.name}
          <span className="review-tab-count">{tab.due}</span>
        </button>
      ))}
    </div>
  );
}

// Shown before a session starts: how many cards are due and what a session is.
export function SessionStart({ dueCards, subject, sessionSize, onStart }) {
  const count = Math.min(sessionSize, dueCards.length);
  const subjects = [];

  for (const card of dueCards) {
    if (!subjects.includes(card.subject)) subjects.push(card.subject);
  }

  return (
    <div className="session-start">
      <p className="eyebrow">{subject ? subject.toUpperCase() : 'SHORT SESSION'}</p>
      <h3>
        {count} card{count === 1 ? '' : 's'} ready
      </h3>
      <p>
        {subject
          ? `A quick round of ${subject} only. It takes a few minutes, and you get a summary at the end.`
          : 'A quick round, mixed from your subjects. It takes a few minutes, and you get a summary at the end.'}
      </p>

      {!subject && subjects.length > 1 && (
        <p className="session-subjects">
          {subjects.map((subject) => (
            <span
              key={subject}
              className="session-subject"
              style={{ '--subject': subjectAccent(subject) }}
            >
              <span className="subject-dot" aria-hidden="true" />
              {subject}
            </span>
          ))}
        </p>
      )}

      <button type="button" className="primary-button" onClick={onStart}>
        Start session
      </button>

      {dueCards.length > count && (
        <p className="session-more">
          {dueCards.length - count} more due after this round.
        </p>
      )}
    </div>
  );
}

function summaryKey(recalled, total) {
  const ratio = total === 0 ? 0 : recalled / total;

  if (ratio === 1) return 'session.line.perfect';
  if (ratio >= 0.8) return 'session.line.strong';
  if (ratio >= 0.5) return 'session.line.solid';

  return 'session.line.tough';
}

// Shown when a session ends: "7/10 recalled", a dot per card, the misses, and
// always a next step: another round, tonight's Daily, or "Done for today".
export function SessionSummary({ results, cards, moreDue, dailyPlayed, onAgain, onStop, onDaily, onDoneToday }) {
  const t = useLoopT();
  const total = results.length;

  // A finished session is the moment the install card may appear.
  useEffect(() => {
    if (total > 0) noteRoundDone('review');
  }, [total]);

  const recalled = results.filter((entry) => entry.recalled).length;
  const missed = results
    .filter((entry) => !entry.recalled)
    .map((entry) => cards.find((card) => card.id === entry.id))
    .filter(Boolean);
  const next = afterRound({ moreDue, dailyPlayed });

  return (
    <div className="session-summary">
      <Jonaki mood={total && recalled === total ? 'wow' : recalled / Math.max(1, total) >= 0.6 ? 'happy' : 'idle'} size={84} className="session-jonaki" />
      <p className="eyebrow">{t('session.done.eyebrow')}</p>
      <p className="session-score mq-pop" aria-label={`${recalled} / ${total} ${t('session.done.recalled')}`}>
        <strong>{recalled}</strong>/{total}
        <span> {t('session.done.recalled')}</span>
      </p>

      <div className="session-dots" aria-hidden="true">
        {results.map((entry, index) => (
          <span
            key={`${entry.id}-${index}`}
            className={entry.recalled ? 'session-dot hit' : 'session-dot miss'}
          />
        ))}
      </div>

      <p className="session-message">{t(summaryKey(recalled, total))}</p>

      {missed.length > 0 && (
        <div className="session-missed">
          <p className="eyebrow">{t('session.missed.title')}</p>
          <ul>
            {missed.map((card) => (
              <li key={card.id} style={{ '--subject': subjectAccent(card.subject) }}>
                <span className="session-q">{card.question}</span>
                <span className="session-a">{card.correctAnswer}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="session-actions">
        {next === 'more' && (
          <>
            <button type="button" className="primary-button" onClick={onAgain}>
              {t('session.next.more', { n: moreDue })}
            </button>
            <button type="button" className="ghost-button" onClick={onStop}>
              {t('session.next.stop')}
            </button>
          </>
        )}
        {next === 'daily' && (
          <>
            <button type="button" className="primary-button" onClick={onDaily}>
              {t('session.next.daily')}
            </button>
            <button type="button" className="ghost-button" onClick={onDoneToday}>
              {t('session.next.done')}
            </button>
          </>
        )}
        {next === 'done' && (
          <button type="button" className="primary-button" onClick={onDoneToday}>
            {t('session.next.done')}
          </button>
        )}
      </div>
    </div>
  );
}
