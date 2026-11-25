import { useCallback, useEffect, useRef, useState } from 'react';
import CATALOG from '../../library/catalog.json';
import { supabase } from '../supabaseClient';
import { trackEvent } from '../googleAnalytics';
import { track } from '../track';
import { haptic } from '../haptics';
import { recordActivity } from '../streak/activity';
import RichText from '../components/RichText';
import Jonaki from '../components/Jonaki';
import { useLoopT } from './strings';
import './round.css';
import './drill.css';

// Step 3 of Today's round: five practice-library questions on the weakest
// section (source chosen by drillSource.js). Finishing marks the step done on
// this device and fires practice_done, like a practice set does.

const LETTERS = 'ABCDE';

const SUBJECT_FOR = {
  vocab: 'English',
  quant: 'Mathematics',
  'school-maths': 'Mathematics',
  physics: 'Physics',
  chemistry: 'Chemistry',
  biology: 'Biology',
};

async function fetchQuestions(source) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  const response = await fetch(`/api/library?c=${encodeURIComponent(source.collection)}&n=${source.set}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const body = await response.json().catch(() => null);

  if (!response.ok || !Array.isArray(body?.questions)) throw new Error(body?.code || 'failed');

  const list = body.questions;
  const start = Math.min(source.offset, Math.max(0, list.length - source.size));

  return list.slice(start, start + source.size);
}

export default function Drill({ source, onFinish, onDone, onLeave, onAddCards }) {
  const t = useLoopT();
  const [state, setState] = useState({ status: 'loading', questions: [] });
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState({});
  const [saved, setSaved] = useState(null);
  const started = useRef(Date.now());
  const collection = CATALOG.collections.find((c) => c.id === source?.collection);

  const load = useCallback(() => {
    if (!source) return;

    setState({ status: 'loading', questions: [] });
    fetchQuestions(source)
      .then((questions) => {
        started.current = Date.now();
        setState({ status: 'ready', questions });
        trackEvent('practice_start', { collection: source.collection, set: source.set, from: 'drill' });
        track('drill_start', { skill: source.skill, n: questions.length });
      })
      .catch(() => setState({ status: 'error', questions: [] }));
  }, [source]);

  useEffect(load, [load]);

  if (!source) return null;

  if (state.status !== 'ready') {
    return (
      <section className="mq-drill mq-drill-center" aria-busy={state.status === 'loading'}>
        <Jonaki mood={state.status === 'error' ? 'oops' : 'think'} size={84} />
        <p>{state.status === 'error' ? t('drill.error') : t('drill.loading')}</p>
        {state.status === 'error' && (
          <div className="mq-empty-actions">
            <button type="button" className="mq-btn mq-btn-primary" onClick={load}>
              {t('drill.retry')}
            </button>
            <button type="button" className="mq-btn mq-btn-ghost" onClick={onLeave}>
              {t('drill.leave')}
            </button>
          </div>
        )}
      </section>
    );
  }

  const { questions } = state;
  const finished = index >= questions.length;
  const score = questions.filter((q) => picked[q.id] === q.answer).length;

  if (finished) {
    const missed = questions.filter((q) => picked[q.id] !== q.answer);

    async function save() {
      setSaved('busy');
      const result = await onAddCards(
        missed.map((q) => ({
          subject: SUBJECT_FOR[source.collection] || collection?.title || 'Practice',
          category: String(q.topic || collection?.title || 'Practice').slice(0, 40),
          question: q.card?.question || q.question,
          correctAnswer: q.card?.answer || q.options[q.answer],
          yourAnswer: Number.isInteger(picked[q.id]) ? q.options[picked[q.id]] : '',
          explanation: (q.explain || '').slice(0, 600),
          distractors: q.card ? [] : q.options.filter((_, i) => i !== q.answer).slice(0, 3),
        }))
      );

      setSaved(result?.error ? 'error' : 'done');
    }

    return (
      <section className="mq-drill mq-drill-center">
        <Jonaki mood={score === questions.length ? 'wow' : 'happy'} size={96} />
        <p className="eyebrow">{source.skill}</p>
        <h2>{t('drill.score', { score, n: questions.length })}</h2>
        <div className="mq-empty-actions">
          {missed.length > 0 && saved !== 'done' && (
            <button type="button" className="mq-btn mq-btn-ghost" disabled={saved === 'busy'} onClick={save}>
              {t('drill.save', { n: missed.length })}
            </button>
          )}
          <button
            type="button"
            className="mq-btn mq-btn-primary"
            onClick={() => {
              haptic.tap();
              onDone();
            }}
          >
            {t('round.continue')}
          </button>
        </div>
        {saved === 'done' && <p role="status">{t('drill.saved')}</p>}
      </section>
    );
  }

  const q = questions[index];
  const chosen = picked[q.id];
  const answered = Number.isInteger(chosen);
  const last = index === questions.length - 1;

  function choose(i) {
    if (answered) return;

    setPicked((p) => ({ ...p, [q.id]: i }));

    if (i === q.answer) haptic.correct();
    else haptic.wrong();
  }

  function next() {
    if (!last) {
      setIndex(index + 1);
      return;
    }

    const finalScore = questions.filter((x) => (x.id === q.id ? chosen : picked[x.id]) === x.answer).length;
    const ms = Date.now() - started.current;

    trackEvent('practice_done', { collection: source.collection, set: source.set, score: finalScore, from: 'drill' });
    track('drill_finish', { skill: source.skill, n: questions.length, correct: finalScore, ms });
    recordActivity('drill');
    onFinish?.();
    setIndex(questions.length);
  }

  return (
    <section className="mq-drill">
      <header className="mq-drill-head">
        <span>
          {source.skill} · {t('drill.of', { i: index + 1, n: questions.length })}
        </span>
      </header>
      <div className="try-progress" aria-hidden="true">
        <span style={{ width: `${((index + (answered ? 1 : 0)) / questions.length) * 100}%` }} />
      </div>

      <div className="try-question">
        <RichText text={q.question} />
      </div>

      <div className="try-options" role="radiogroup">
        {q.options.map((option, i) => {
          const look = !answered ? '' : i === q.answer ? ' right' : i === chosen ? ' wrong' : ' dim';

          return (
            <button
              key={`${q.id}-${i}`}
              type="button"
              role="radio"
              aria-checked={chosen === i}
              disabled={answered}
              className={`try-option${look}`}
              onClick={() => choose(i)}
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
          <b>{chosen === q.answer ? t('drill.correct') : t('drill.wrong', { letter: LETTERS[q.answer] })}</b>
          {q.explain && (
            <div className="pr-explain">
              <RichText text={q.explain} />
            </div>
          )}
        </div>
      )}

      <footer className="try-nav">
        <span />
        <button type="button" className="mq-btn mq-btn-primary" disabled={!answered} onClick={next}>
          {last ? t('drill.finish') : t('drill.next')}
        </button>
      </footer>

      {collection && <p className="pr-credit">{t('drill.credit', { source: collection.source.name, license: collection.source.license })}</p>}
    </section>
  );
}
