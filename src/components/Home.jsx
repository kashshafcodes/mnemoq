import { useMemo } from 'react';
import { computeAnalytics, headline } from '../analytics';
import { subjectAccent } from '../subjects';
import { pageHref } from '../useRoute';

// The home page: every section in short form, each with a link to its own page.

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Tile({ title, to, linkLabel, className = '', children }) {
  return (
    <section className={`home-tile ${className}`.trim()}>
      <header>
        <h2>{title}</h2>
        <a className="home-link" href={pageHref(to)}>
          {linkLabel} <span aria-hidden="true">→</span>
        </a>
      </header>
      {children}
    </section>
  );
}

export default function Home({ cards, reviews, dueCount, onReview }) {
  const data = useMemo(() => computeAnalytics(cards, reviews, new Date()), [cards, reviews]);
  const { stats } = data;
  const message = headline(stats);

  const subjects = useMemo(() => {
    const counts = new Map();

    for (const card of cards) counts.set(card.subject, (counts.get(card.subject) || 0) + 1);

    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [cards]);

  const latest = useMemo(
    () => [...cards].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).slice(0, 3),
    [cards]
  );

  return (
    <div className="home">
      <section className="home-hero">
        <h2>{message.title}</h2>
        <p>{message.body}</p>
      </section>

      <div className="home-grid">
        <Tile title="Review" to="review" linkLabel="Open review" className="home-review">
          {cards.length === 0 ? (
            <p className="home-muted">Add your first card, then come back here to review it.</p>
          ) : dueCount > 0 ? (
            <>
              <p className="home-big">
                {dueCount} <span>{dueCount === 1 ? 'card due' : 'cards due'}</span>
              </p>
              <p className="home-muted">A short session takes about five minutes.</p>
              <button type="button" className="qa-primary" onClick={onReview}>
                Start review
              </button>
            </>
          ) : (
            <>
              <p className="home-big home-ok">All caught up</p>
              <p className="home-muted">Your cards will come back when they are due.</p>
            </>
          )}
        </Tile>

        <Tile title="Progress" to="progress" linkLabel="See all progress" className="home-progress">
          <dl className="home-stats">
            <div>
              <dt>Cards</dt>
              <dd>{stats.totalCards}</dd>
            </div>
            <div>
              <dt>Mastered</dt>
              <dd>{stats.mastered}</dd>
            </div>
            <div>
              <dt>Day streak</dt>
              <dd>{stats.streak.current}</dd>
            </div>
          </dl>
        </Tile>

        <Tile title="Library" to="library" linkLabel="Open library" className="home-library">
          {cards.length === 0 ? (
            <p className="home-muted">Nothing saved yet.</p>
          ) : (
            <>
              <p className="home-muted">{plural(cards.length, 'card')} across {plural(subjects.length, 'subject')}</p>
              <ul className="home-subjects">
                {subjects.slice(0, 5).map(([name, count]) => (
                  <li key={name} style={{ '--accent': subjectAccent(name) }}>
                    <span className="subject-dot" aria-hidden="true" />
                    {name} <b>{count}</b>
                  </li>
                ))}
              </ul>
              <ul className="home-latest">
                {latest.map((card) => (
                  <li key={card.id}>{card.question}</li>
                ))}
              </ul>
            </>
          )}
        </Tile>

        <Tile title="Add cards" to="add" linkLabel="Add cards" className="home-add">
          <p className="home-muted">
            Save something you got wrong or want to remember. Only a question and the correct answer are needed.
          </p>
          <a className="qa-primary home-button" href={pageHref('add')}>
            + Add a card
          </a>
        </Tile>
      </div>
    </div>
  );
}
