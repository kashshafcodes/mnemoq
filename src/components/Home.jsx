import { useEffect, useMemo, useState } from 'react';
import { computeAnalytics, headline } from '../analytics';
import { loadReminderState, pushSupported } from '../reminders';
import { subjectAccent } from '../subjects';
import { pageHref } from '../useRoute';
import AiBadge from './AiBadge';
import CATALOG from '../../library/catalog.json';

// The home page: one clear next step, a few numbers, and short links to the
// rest. Everything else lives on its own page.

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// What should this person do right now? The most useful single action.
function nextStep({ cards, dueCount, pathInfo, onReview }) {
  if (dueCount > 0) {
    return {
      tone: 'due',
      kicker: 'Ready now',
      title: `${plural(dueCount, 'card')} ${dueCount === 1 ? 'is' : 'are'} fading`,
      body: `Review ${dueCount === 1 ? 'it' : 'them'} now, while it counts most. About ${Math.max(1, Math.round(Math.min(dueCount, 10) * 0.4))} min.`,
      action: { label: 'Start review', onClick: onReview },
    };
  }

  if (pathInfo && !pathInfo.hasDiagnostic) {
    return {
      tone: 'path',
      kicker: pathInfo.name,
      title: pathInfo.engine === 'sat' ? 'Get your first SAT score estimate' : 'See where you stand',
      body:
        pathInfo.engine === 'sat'
          ? 'A free 25-minute diagnostic gives you a 400–1600 estimate and a map of every skill.'
          : 'The AI diagnostic checks every section and tells you what to fix first.',
      action: { label: 'Start the diagnostic', href: pageHref('path') },
    };
  }

  if (cards.length === 0) {
    return {
      tone: 'start',
      kicker: 'Start here',
      title: 'Save your first mistake',
      body: 'Think of one question you got wrong recently. Add it, and Mnemoq will bring it back right before you forget.',
      action: { label: 'Add a card', href: pageHref('add') },
      second: pathInfo ? null : { label: 'Or choose your exam', href: pageHref('path') },
    };
  }

  return {
    tone: 'done',
    kicker: 'All caught up',
    title: 'Nothing is due right now',
    body: pathInfo
      ? `Use the time to practise for ${pathInfo.short}, or add today’s mistakes so they come back later.`
      : 'Add today’s mistakes so they come back later, or pick an exam for a full plan.',
    action: pathInfo ? { label: pathInfo.engine === 'sat' ? 'Practise SAT' : 'Take a mock test', href: pageHref(pathInfo.engine === 'sat' ? 'path' : 'mocks') } : { label: 'Add cards', href: pageHref('add') },
    second: pathInfo ? { label: 'Add cards', href: pageHref('add') } : { label: 'Choose my exam', href: pageHref('path') },
  };
}

function ReminderNudge({ userId }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;

    try {
      if (localStorage.getItem('mnemoq-hide-reminder-nudge') === '1') return undefined;
    } catch {
      // ignore
    }

    if (!userId || !pushSupported()) return undefined;

    loadReminderState(userId)
      .then((state) => {
        if (!cancelled && !state.setup && !(state.settings.enabled && state.thisDevice)) setShow(true);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!show) return null;

  return (
    <section className="mq-nudge">
      <span className="mq-nudge-icon" aria-hidden="true">
        🔔
      </span>
      <div>
        <h2>Get a nudge when cards are due</h2>
        <p>Spaced repetition only works if you come back on time. One tap, and your phone reminds you.</p>
      </div>
      <div className="mq-nudge-actions">
        <a className="mq-btn mq-btn-primary" href={`${pageHref('profile')}?reminders`}>
          Turn on
        </a>
        <button
          type="button"
          className="mq-btn mq-btn-quiet"
          onClick={() => {
            setShow(false);
            try {
              localStorage.setItem('mnemoq-hide-reminder-nudge', '1');
            } catch {
              // ignore
            }
          }}
        >
          Not now
        </button>
      </div>
    </section>
  );
}

export default function Home({ cards, reviews, dueCount, onReview, pathInfo = null, pathLoading = false, userId = null }) {
  const data = useMemo(() => computeAnalytics(cards, reviews, new Date()), [cards, reviews]);
  const { stats } = data;
  const message = headline(stats);
  const step = nextStep({ cards, dueCount, pathInfo, onReview });

  const subjects = useMemo(() => {
    const counts = new Map();

    for (const card of cards) counts.set(card.subject, (counts.get(card.subject) || 0) + 1);

    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [cards]);

  const latest = useMemo(
    () => [...cards].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 4),
    [cards]
  );

  return (
    <div className="mq-home">
      <section className={`mq-focus mq-focus-${step.tone}`}>
        <p className="mq-focus-kicker">{step.kicker}</p>
        <h2>{step.title}</h2>
        <p>{step.body}</p>
        <div className="mq-focus-actions">
          {step.action.onClick ? (
            <button type="button" className="mq-btn mq-btn-primary mq-btn-lg" onClick={step.action.onClick}>
              {step.action.label} <span aria-hidden="true">→</span>
            </button>
          ) : (
            <a className="mq-btn mq-btn-primary mq-btn-lg" href={step.action.href}>
              {step.action.label} <span aria-hidden="true">→</span>
            </a>
          )}
          {step.second && (
            <a className="mq-btn mq-btn-ghost mq-btn-lg" href={step.second.href}>
              {step.second.label}
            </a>
          )}
        </div>
      </section>

      {cards.length > 0 && (
        <dl className="mq-stats">
          <div>
            <dt>Day streak</dt>
            <dd>
              {stats.streak.current}
              {stats.streak.current > 0 && <span aria-hidden="true"> 🔥</span>}
            </dd>
          </div>
          <div>
            <dt>Cards</dt>
            <dd>{stats.totalCards}</dd>
          </div>
          <div>
            <dt>Mastered</dt>
            <dd>{stats.mastered}</dd>
          </div>
          <div>
            <dt>Due now</dt>
            <dd>{dueCount}</dd>
          </div>
        </dl>
      )}

      {cards.length > 0 && <p className="mq-home-message">{message.title} {message.body}</p>}

      <ReminderNudge userId={userId} />

      <div className="mq-home-grid">
        {pathInfo ? (
          <a className="mq-tile" href={pageHref('path')}>
            <header>
              <h2>
                {pathInfo.name} <AiBadge />
              </h2>
              <span className="mq-tile-arrow" aria-hidden="true">
                →
              </span>
            </header>
            <div className="mq-tile-numbers">
              <p>
                <b>{pathInfo.daysLeft !== null ? pathInfo.daysLeft : '–'}</b>
                <span>{pathInfo.daysLeft === null ? 'no exam date yet' : pathInfo.daysLeft === 1 ? 'day left' : 'days left'}</span>
              </p>
              <p>
                <b>{pathInfo.readiness !== null ? pathInfo.readiness : '–'}</b>
                <span>
                  {pathInfo.word}, target {pathInfo.target}
                </span>
              </p>
            </div>
            <p className="mq-tile-note">
              {pathInfo.hasDiagnostic
                ? pathInfo.weakest
                  ? `Weakest: ${pathInfo.weakest.name}. ${pathInfo.progress.label}.`
                  : `${pathInfo.progress.label}.`
                : 'No diagnostic yet.'}
            </p>
          </a>
        ) : (
          !pathLoading && (
            <a className="mq-tile mq-tile-invite" href={pageHref('path')}>
              <header>
                <h2>
                  Preparing for an exam? <AiBadge />
                </h2>
                <span className="mq-tile-arrow" aria-hidden="true">
                  →
                </span>
              </header>
              <p className="mq-tile-note">
                Digital SAT or NSU admission: get a countdown, a diagnostic of every section and a score that moves as you practise.
              </p>
            </a>
          )
        )}

        <a className="mq-tile mq-tile-invite" href={pageHref('practice')}>
          <header>
            <h2>Practice library</h2>
            <span className="mq-tile-arrow" aria-hidden="true">
              →
            </span>
          </header>
          <p className="mq-tile-note">
            {CATALOG.total.toLocaleString()} questions from vocabulary to physics, in sets of {CATALOG.setSize}. The first set of each is free, and every
            mistake can become a review card.
          </p>
        </a>

        <a className="mq-tile" href={pageHref('library')}>
          <header>
            <h2>Your library</h2>
            <span className="mq-tile-arrow" aria-hidden="true">
              →
            </span>
          </header>
          {cards.length === 0 ? (
            <p className="mq-tile-note">Nothing saved yet. Every card you add lives here.</p>
          ) : (
            <>
              <p className="mq-tile-note">
                {plural(cards.length, 'card')} in {plural(subjects.length, 'subject')}
              </p>
              <ul className="mq-subjects">
                {subjects.slice(0, 4).map(([name, count]) => (
                  <li key={name} style={{ '--subject': subjectAccent(name) }}>
                    <span className="subject-dot" aria-hidden="true" />
                    {name} <b>{count}</b>
                  </li>
                ))}
              </ul>
              <ul className="mq-latest">
                {latest.map((card) => (
                  <li key={card.id}>{card.question}</li>
                ))}
              </ul>
            </>
          )}
        </a>
      </div>
    </div>
  );
}
