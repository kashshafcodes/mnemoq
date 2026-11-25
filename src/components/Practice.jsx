import { useEffect, useMemo, useState } from 'react';
import CATALOG from '../../library/catalog.json';
import { trackEvent } from '../googleAnalytics';
import { supabase } from '../supabaseClient';
import { Paywall, ProBadge } from './Pro';
import RichText from './RichText';
import { useI18n } from '../i18n';
import { freeSetCount, freeTotals, isFreeSet } from '../practice/access';
import { localizeQuestion } from '../practice/overlay';
import KeptMisses from '../practice/KeptMisses';
import { feel } from '../sensory';
import { CountUp } from '../sensory/celebrate';
import { earn, flushGlowEvents } from '../glow/store';
import { recordActivity } from '../streak/activity';
import { practiceT, usePracticeT } from '../practice/strings';

// The practice library (#/practice): thousands of questions in 20-question
// sets, from openly licensed sources (library/SOURCES.md). The first half of
// each collection's sets is free and the rest are Pro (src/practice/access.js,
// enforced by api/library.js). Every miss is kept as a review card
// (src/practice/KeptMisses.jsx), which is the point of Mnemoq.

const PROGRESS_KEY = 'mnemoq-practice';
const LETTERS = 'ABCDE';
const FREE = freeTotals(CATALOG);

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

async function fetchSet(id, n, lang) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const response = await fetch(`/api/library?c=${encodeURIComponent(id)}&n=${n}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.questions) {
    const error = new Error(body?.code === 'pro' && body?.error ? body.error : practiceT(lang)('pr.error'));

    error.code = body?.code || 'failed';
    throw error;
  }

  return body.questions;
}

function Runner({ collection, n, questions, onDone, onQuit }) {
  const { lang } = useI18n();
  const t = usePracticeT();
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState({});
  const q = localizeQuestion(questions[index], lang);
  const chosen = picked[q.id];
  const answered = Number.isInteger(chosen);
  const correctSoFar = questions.filter((x) => picked[x.id] === x.answer).length;
  const last = index === questions.length - 1;

  return (
    <section className="pr-run">
      <header className="pr-run-head">
        <span>
          {t('pr.run.where', { title: collection.title, n, i: index + 1, total: questions.length })}
        </span>
        <span className="pr-score">{t('pr.run.score', { n: correctSoFar })}</span>
        <button type="button" className="text-link" onClick={onQuit}>
          {t('pr.run.leave')}
        </button>
      </header>
      <div className="try-progress" aria-hidden="true">
        <span style={{ width: `${((index + (answered ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>

      {q.topic && <p className="pr-topic">{q.topic}</p>}
      <div className="try-question">
        <RichText text={q.question} />
      </div>

      <div className="try-options" role="radiogroup" aria-label={t('pr.run.answers')}>
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
              onClick={(event) => {
                feel(i === q.answer ? 'correct' : 'wrong', { el: event.currentTarget });
                setPicked((p) => ({ ...p, [q.id]: i }));
                // An answered practice question is a learning day; a right one pays 2 Glow (once a day).
                recordActivity('practice');
                earn({ type: 'practice', questionId: `${collection.id || collection}:${q.id}`, correct: i === q.answer });
              }}
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
          <b>{chosen === q.answer ? t('pr.run.correct') : t('pr.run.wrong', { letter: LETTERS[q.answer] })}</b>
          {q.explain && (
            <div className="pr-explain">
              <RichText text={q.explain} />
            </div>
          )}
        </div>
      )}

      <footer className="try-nav">
        <button type="button" className="mq-btn mq-btn-ghost" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          {t('pr.run.back')}
        </button>
        {last ? (
          <button
            type="button"
            className="mq-btn mq-btn-primary"
            disabled={!answered}
            onClick={() => {
              feel('step.done');
              onDone(picked);
            }}
          >
            {t('pr.run.finish')}
          </button>
        ) : (
          <button
            type="button"
            className="mq-btn mq-btn-primary"
            disabled={!answered}
            onClick={(event) => {
              feel('tap.primary', { el: event.currentTarget });
              setIndex(index + 1);
            }}
          >
            {t('pr.run.next')}
          </button>
        )}
      </footer>
    </section>
  );
}

function Summary({ collection, n, questions, picked, plan, onAddCards, onRemoveCards, onNext, onBack }) {
  const t = usePracticeT();
  const missed = questions.filter((q) => picked[q.id] !== q.answer);
  const score = questions.length - missed.length;
  const hasNext = n < collection.sets;

  return (
    <section className="pr-summary">
      <p className="lp-kicker">
        {t('pr.sum.where', { title: collection.title, n })}
      </p>
      <h2>
        <CountUp value={score} /> {t('pr.sum.score', { total: questions.length })}
      </h2>
      {score === questions.length && <p className="pr-muted">{t('pr.sum.perfect')}</p>}
      <KeptMisses collection={collection} n={n} questions={questions} picked={picked} onAddCards={onAddCards} onRemoveCards={onRemoveCards} />
      <div className="mq-focus-actions">
        {hasNext && (
          <button type="button" className="mq-btn mq-btn-primary" onClick={onNext}>
            {!isFreeSet(collection.sets, n + 1) && !plan.pro ? <>{t('pr.sum.next')} <ProBadge /></> : t('pr.sum.next')}
          </button>
        )}
        <button type="button" className="mq-btn mq-btn-quiet" onClick={onBack}>
          {t('pr.sum.all')}
        </button>
      </div>
    </section>
  );
}

export default function Practice({ plan, onAddCards, onRemoveCards }) {
  const { lang } = useI18n();
  const t = usePracticeT();
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
    // Locked sets open the Pro hint calmly: the quiet tap, no shake.
    feel(!isFreeSet(c.sets, n) && !plan.pro ? 'tap.secondary' : 'tap.primary');
    if (!isFreeSet(c.sets, n) && !plan.pro) {
      const free = freeSetCount(c.sets);

      setPaywall({
        feature: 'bank',
        reason: t('pr.lock', { free, title: c.title, rest: (c.sets - free).toLocaleString(), more: (CATALOG.total - FREE.questions).toLocaleString() }),
      });
      return;
    }

    setLoading(true);
    setError('');

    try {
      const questions = await fetchSet(c.id, n, lang);

      trackEvent('practice_start', { collection: c.id, set: n });
      setView({ name: 'run', collectionId: c.id, n, questions, run: Date.now() });
    } catch (caught) {
      if (caught.code === 'pro') setPaywall({ feature: 'bank', reason: caught.message });
      else {
        feel('error');
        setError(caught.message);
      }
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
    flushGlowEvents();
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
          onRemoveCards={onRemoveCards}
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
      <div className="pr fx-deeper">
        <button type="button" className="text-link pr-back" onClick={() => setView({ name: 'home' })}>
          {t('pr.back')}
        </button>
        <header className="mq-page-head">
          <p className="pr-group">{collection.group}</p>
          <h1>{collection.title}</h1>
          <p className="pr-muted">{collection.blurb}</p>
          <p className="pr-meta">
            {t('pr.meta.full', { q: collection.questions.toLocaleString(), sets: collection.sets, size: CATALOG.setSize })}
            {collection.worked ? t('pr.meta.worked') : ''}
            {t('pr.meta.free', { free: freeSetCount(collection.sets), done: doneCount })}
          </p>
        </header>
        {error && <p className="pro-message">{error}</p>}
        <ol className="pr-sets fx-list">
          {Array.from({ length: collection.sets }, (_, i) => i + 1).map((n) => {
            const p = progress[`${collection.id}:${n}`];
            const free = isFreeSet(collection.sets, n);
            const locked = !free && !plan.pro;

            return (
              <li key={n}>
                <button type="button" className={`pr-set${p ? ' done' : ''}${locked ? ' locked' : ''}`} disabled={loading} onClick={() => open(collection, n)}>
                  <span>{t('pr.set', { n })}</span>
                  {p ? <b>{t('pr.n', { n: `${p.best}/${p.total}` })}</b> : free ? <em>{t('pr.free')}</em> : locked ? <ProBadge /> : <em>{t('pr.start')}</em>}
                </button>
              </li>
            );
          })}
        </ol>
        <p className="pr-credit">
          {t('pr.credit')}{' '}
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
        <h1>{t('pr.title')}</h1>
        <p className="pr-muted">{t('pr.intro', { total: CATALOG.total.toLocaleString(), n: CATALOG.collections.length, free: FREE.questions.toLocaleString() })}</p>
      </header>
      <div className="mq-seg pr-groups" role="tablist" aria-label={t('pr.subjects')}>
        {groups.map((g) => (
          <button key={g} type="button" role="tab" aria-selected={group === g} className={group === g ? 'active' : ''} onClick={() => setGroup(g)}>
            {g === 'All' ? t('pr.all') : g}
          </button>
        ))}
      </div>
      <div className="pr-grid fx-list">
        {shown.map((c) => {
          const done = Object.keys(progress).filter((k) => k.startsWith(`${c.id}:`)).length;

          return (
            <button key={c.id} type="button" className="pr-card" onClick={() => setView({ name: 'collection', collectionId: c.id })}>
              <span className="pr-group">{c.group}</span>
              <h2>{c.title}</h2>
              <p>{c.blurb}</p>
              <span className="pr-meta">
                {t('pr.meta.card', { q: c.questions.toLocaleString(), sets: c.sets })}
                {done ? t('pr.meta.done', { n: done }) : ''}
              </span>
            </button>
          );
        })}
      </div>
      {sheet}
    </div>
  );
}
