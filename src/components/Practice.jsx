import { useEffect, useMemo, useState } from 'react';
import CATALOG from '../../library/catalog.json';
import { trackEvent } from '../googleAnalytics';
import { supabase } from '../supabaseClient';
import { Paywall, ProBadge } from './Pro';
import RichText from './RichText';

// The practice library (#/practice): thousands of questions in 20-question
// sets, from openly licensed sources (library/SOURCES.md). Set 1 of every
// collection is free; the rest are Pro (enforced by api/library.js).
// Every miss can become a review card, which is the point of Mnemoq.

const FREE_SETS = 1;
const PROGRESS_KEY = 'mnemoq-practice';
const LETTERS = 'ABCDE';

const SUBJECT_FOR = {
  vocab: 'English',
  'word-problems': 'Mathematics',
  quant: 'Mathematics',
  'school-maths': 'Mathematics',
  'higher-maths': 'Mathematics',
  physics: 'Physics',
  chemistry: 'Chemistry',
  biology: 'Biology',
  'computer-science': 'Computer Science',
  economics: 'Economics',
  geography: 'Geography',
};

function readProgress() {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveProgress(next) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
  } catch {
    // Progress is a convenience; practice still works without it.
  }
}

async function fetchSet(id, n) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const response = await fetch(`/api/library?c=${encodeURIComponent(id)}&n=${n}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.questions) {
    const error = new Error(body?.error || 'This set could not be loaded. Check your connection.');

    error.code = body?.code || 'failed';
    throw error;
  }

  return body.questions;
}

function Runner({ collection, n, questions, onDone, onQuit }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState({});
  const q = questions[index];
  const chosen = picked[q.id];
  const answered = Number.isInteger(chosen);
  const correctSoFar = questions.filter((x) => picked[x.id] === x.answer).length;
  const last = index === questions.length - 1;

  return (
    <section className="pr-run">
      <header className="pr-run-head">
        <span>
          {collection.title} · Set {n} · {index + 1} of {questions.length}
        </span>
        <span className="pr-score">{correctSoFar} correct</span>
        <button type="button" className="text-link" onClick={onQuit}>
          Leave
        </button>
      </header>
      <div className="try-progress" aria-hidden="true">
        <span style={{ width: `${((index + (answered ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>

      {q.topic && <p className="pr-topic">{q.topic}</p>}
      <div className="try-question">
        <RichText text={q.question} />
      </div>

      <div className="try-options" role="radiogroup" aria-label="Answers">
        {q.options.map((option, i) => {
          const state = !answered ? '' : i === q.answer ? ' right' : i === chosen ? ' wrong' : ' dim';

          return (
            <button
              key={`${q.id}-${i}`}
              type="button"
              role="radio"
              aria-checked={chosen === i}
              disabled={answered}
              className={`try-option${state}`}
              onClick={() => setPicked((p) => ({ ...p, [q.id]: i }))}
            >
              <span className="try-letter">{LETTERS[i]}</span>
              <span>
                <RichText text={option} graphs={false} />
              </span>
            </button>
          );
        })}
      </div>

      {answered && (
        <div className={chosen === q.answer ? 'pr-feedback ok' : 'pr-feedback'} role="status">
          <b>{chosen === q.answer ? 'Correct.' : `Not quite. The answer is ${LETTERS[q.answer]}.`}</b>
          {q.explain && (
            <div className="pr-explain">
              <RichText text={q.explain} />
            </div>
          )}
        </div>
      )}

      <footer className="try-nav">
        <button type="button" className="mq-btn mq-btn-ghost" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          Back
        </button>
        {last ? (
          <button type="button" className="mq-btn mq-btn-primary" disabled={!answered} onClick={() => onDone(picked)}>
            See my score
          </button>
        ) : (
          <button type="button" className="mq-btn mq-btn-primary" disabled={!answered} onClick={() => setIndex(index + 1)}>
            Next
          </button>
        )}
      </footer>
    </section>
  );
}

function Summary({ collection, n, questions, picked, plan, onAddCards, onNext, onBack }) {
  const missed = questions.filter((q) => picked[q.id] !== q.answer);
  const score = questions.length - missed.length;
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const hasNext = n < collection.sets;

  async function save() {
    setBusy(true);

    const cards = missed.map((q) => ({
      subject: SUBJECT_FOR[collection.id] || collection.title,
      category: String(q.topic || collection.title).slice(0, 40),
      question: q.card?.question || q.question,
      correctAnswer: q.card?.answer || q.options[q.answer],
      yourAnswer: Number.isInteger(picked[q.id]) ? q.options[picked[q.id]] : '',
      explanation: (q.explain || '').slice(0, 600),
      distractors: q.card ? [] : q.options.filter((_, i) => i !== q.answer).slice(0, 3),
    }));
    const result = await onAddCards(cards);

    setBusy(false);
    setSaved(result?.error ? { error: result.error } : { added: result?.added ?? cards.length });
  }

  return (
    <section className="pr-summary">
      <p className="lp-kicker">
        {collection.title} · Set {n}
      </p>
      <h2>
        {score} of {questions.length} correct
      </h2>
      <p className="pr-muted">
        {score === questions.length
          ? 'A perfect set. Try the next one.'
          : `Save the ${missed.length} you missed as review cards and Mnemoq will bring each one back right before you forget it.`}
      </p>
      <div className="mq-focus-actions">
        {missed.length > 0 && !saved && (
          <button type="button" className="mq-btn mq-btn-primary" disabled={busy} onClick={save}>
            {busy ? 'Saving…' : `Save ${missed.length} as review cards`}
          </button>
        )}
        {hasNext && (
          <button type="button" className={missed.length > 0 && !saved ? 'mq-btn mq-btn-ghost' : 'mq-btn mq-btn-primary'} onClick={onNext}>
            {n + 1 > FREE_SETS && !plan.pro ? <>Next set <ProBadge /></> : 'Next set'}
          </button>
        )}
        <button type="button" className="mq-btn mq-btn-quiet" onClick={onBack}>
          All sets
        </button>
      </div>
      {saved?.added > 0 && (
        <p className="pr-saved" role="status">
          Saved {saved.added} cards. They are in your review queue now.
        </p>
      )}
      {saved?.error && <p className="pro-message">{saved.error}</p>}
    </section>
  );
}

export default function Practice({ plan, onAddCards }) {
  const [group, setGroup] = useState('All');
  const [view, setView] = useState({ name: 'home' });
  const [progress, setProgress] = useState(readProgress);
  const [paywall, setPaywall] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const groups = useMemo(() => ['All', ...new Set(CATALOG.collections.map((c) => c.group))], []);
  const collection = view.collectionId ? CATALOG.collections.find((c) => c.id === view.collectionId) : null;

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [view.name, view.n]);

  async function open(c, n) {
    if (n > FREE_SETS && !plan.pro) {
      setPaywall({ feature: 'bank', reason: `Set 1 of every collection is free. The other ${(c.sets - FREE_SETS).toLocaleString()} sets of ${c.title} come with Mnemoq Pro, along with ${(CATALOG.total - CATALOG.collections.length * CATALOG.setSize).toLocaleString()} more questions across every subject.` });
      return;
    }

    setLoading(true);
    setError('');

    try {
      const questions = await fetchSet(c.id, n);

      trackEvent('practice_start', { collection: c.id, set: n });
      setView({ name: 'run', collectionId: c.id, n, questions, run: Date.now() });
    } catch (caught) {
      if (caught.code === 'pro') setPaywall({ feature: 'bank', reason: caught.message });
      else setError(caught.message);
    } finally {
      setLoading(false);
    }
  }

  function done(picked) {
    const score = view.questions.filter((q) => picked[q.id] === q.answer).length;
    const key = `${view.collectionId}:${view.n}`;
    const next = { ...progress, [key]: { best: Math.max(score, progress[key]?.best || 0), total: view.questions.length, at: Date.now() } };

    saveProgress(next);
    setProgress(next);
    trackEvent('practice_done', { collection: view.collectionId, set: view.n, score });
    setView({ ...view, name: 'done', picked });
  }

  const sheet = paywall && <Paywall prompt={paywall} onClose={() => setPaywall(null)} />;

  if (view.name === 'run') {
    return (
      <Runner
        key={view.run}
        collection={collection}
        n={view.n}
        questions={view.questions}
        onDone={done}
        onQuit={() => setView({ name: 'collection', collectionId: view.collectionId })}
      />
    );
  }

  if (view.name === 'done') {
    return (
      <>
        <Summary
          collection={collection}
          n={view.n}
          questions={view.questions}
          picked={view.picked}
          plan={plan}
          onAddCards={onAddCards}
          onNext={() => open(collection, view.n + 1)}
          onBack={() => setView({ name: 'collection', collectionId: view.collectionId })}
        />
        {sheet}
      </>
    );
  }

  if (view.name === 'collection' && collection) {
    const doneCount = Array.from({ length: collection.sets }, (_, i) => progress[`${collection.id}:${i + 1}`]).filter(Boolean).length;

    return (
      <div className="pr">
        <button type="button" className="text-link pr-back" onClick={() => setView({ name: 'home' })}>
          ← All collections
        </button>
        <header className="mq-page-head">
          <p className="pr-group">{collection.group}</p>
          <h1>{collection.title}</h1>
          <p className="pr-muted">{collection.blurb}</p>
          <p className="pr-meta">
            {collection.questions.toLocaleString()} questions · {collection.sets} sets of {CATALOG.setSize}
            {collection.worked ? ' · worked solutions' : ''} · {doneCount} done
          </p>
        </header>
        {error && <p className="pro-message">{error}</p>}
        <ol className="pr-sets">
          {Array.from({ length: collection.sets }, (_, i) => i + 1).map((n) => {
            const p = progress[`${collection.id}:${n}`];
            const locked = n > FREE_SETS && !plan.pro;

            return (
              <li key={n}>
                <button type="button" className={`pr-set${p ? ' done' : ''}${locked ? ' locked' : ''}`} disabled={loading} onClick={() => open(collection, n)}>
                  <span>Set {n}</span>
                  {p ? <b>{p.best}/{p.total}</b> : n <= FREE_SETS ? <em>Free</em> : locked ? <ProBadge /> : <em>Start</em>}
                </button>
              </li>
            );
          })}
        </ol>
        <p className="pr-credit">
          Questions from{' '}
          <a href={collection.source.url} target="_blank" rel="noreferrer">
            {collection.source.name}
          </a>{' '}
          ({collection.source.license}).
        </p>
        {sheet}
      </div>
    );
  }

  const shown = CATALOG.collections.filter((c) => group === 'All' || c.group === group);

  return (
    <div className="pr">
      <header className="mq-page-head">
        <h1>Practice library</h1>
        <p className="pr-muted">
          {CATALOG.total.toLocaleString()} questions in {CATALOG.collections.length} collections, from vocabulary to physics. Set 1 of every collection is free. Every
          mistake can become a review card.
        </p>
      </header>
      <div className="mq-seg pr-groups" role="tablist" aria-label="Subjects">
        {groups.map((g) => (
          <button key={g} type="button" role="tab" aria-selected={group === g} className={group === g ? 'active' : ''} onClick={() => setGroup(g)}>
            {g}
          </button>
        ))}
      </div>
      <div className="pr-grid">
        {shown.map((c) => {
          const done = Object.keys(progress).filter((k) => k.startsWith(`${c.id}:`)).length;

          return (
            <button key={c.id} type="button" className="pr-card" onClick={() => setView({ name: 'collection', collectionId: c.id })}>
              <span className="pr-group">{c.group}</span>
              <h2>{c.title}</h2>
              <p>{c.blurb}</p>
              <span className="pr-meta">
                {c.questions.toLocaleString()} questions · {c.sets} sets{done ? ` · ${done} done` : ''}
              </span>
            </button>
          );
        })}
      </div>
      {sheet}
    </div>
  );
}
