import { subjectAccent } from '../subjects';

// Shown before a session starts: how many cards are due and what a session is.
export function SessionStart({ dueCards, sessionSize, onStart }) {
  const count = Math.min(sessionSize, dueCards.length);
  const subjects = [];

  for (const card of dueCards) {
    if (!subjects.includes(card.subject)) subjects.push(card.subject);
  }

  return (
    <div className="session-start">
      <p className="eyebrow">SHORT SESSION</p>
      <h3>
        {count} card{count === 1 ? '' : 's'} ready
      </h3>
      <p>
        A quick round, mixed from your subjects. It takes a few minutes, and
        you get a summary at the end.
      </p>

      {subjects.length > 1 && (
        <p className="session-subjects">
          {subjects.map((subject) => (
            <span
              key={subject}
              className="session-subject"
              style={{ '--accent': subjectAccent(subject) }}
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

function summaryLine(recalled, total) {
  const ratio = total === 0 ? 0 : recalled / total;

  if (ratio === 1) return 'Perfect round. Nothing slipped.';
  if (ratio >= 0.8) return 'Strong session. Most of it is sticking.';
  if (ratio >= 0.5) return 'Solid. The ones you missed will come back soon.';

  return 'A tough set, and that is how it sticks. The misses will return soon.';
}

// Shown when a session ends: "7/10 recalled", a dot per card, and the misses.
export function SessionSummary({ results, cards, moreDue, onAgain, onDone }) {
  const total = results.length;
  const recalled = results.filter((entry) => entry.recalled).length;
  const missed = results
    .filter((entry) => !entry.recalled)
    .map((entry) => cards.find((card) => card.id === entry.id))
    .filter(Boolean);

  return (
    <div className="session-summary">
      <p className="eyebrow">SESSION COMPLETE</p>
      <p className="session-score" aria-label={`${recalled} of ${total} recalled`}>
        <strong>{recalled}</strong>/{total}
        <span> recalled</span>
      </p>

      <div className="session-dots" aria-hidden="true">
        {results.map((entry, index) => (
          <span
            key={`${entry.id}-${index}`}
            className={entry.recalled ? 'session-dot hit' : 'session-dot miss'}
          />
        ))}
      </div>

      <p className="session-message">{summaryLine(recalled, total)}</p>

      {missed.length > 0 && (
        <div className="session-missed">
          <p className="eyebrow">WORTH ANOTHER LOOK</p>
          <ul>
            {missed.map((card) => (
              <li key={card.id} style={{ '--accent': subjectAccent(card.subject) }}>
                <span className="session-q">{card.question}</span>
                <span className="session-a">{card.correctAnswer}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="session-actions">
        {moreDue > 0 && (
          <button type="button" className="primary-button" onClick={onAgain}>
            Another session ({moreDue} due)
          </button>
        )}
        <button
          type="button"
          className={moreDue > 0 ? 'ghost-button' : 'primary-button'}
          onClick={onDone}
        >
          Done
        </button>
      </div>
    </div>
  );
}
