import { useEffect, useMemo, useRef, useState } from 'react';
import { getPath } from '../paths';
import { mistakesOf } from '../readiness';
import { trackEvent } from '../googleAnalytics';
import { pageHref } from '../useRoute';
import AiBadge from './AiBadge';
import RichText from './RichText';
import { PRO } from '../proConfig';
import { priceOf, taka } from '../pricing';

// The full diagnostic report (#/report): score, sections, the AI coach's
// analysis, every mistake with the right answer, and one tap to turn the
// mistakes into review cards. Free for everyone: this is the moment a new
// student decides whether Mnemoq is worth keeping.

const LETTERS = 'ABCDE';

function Gauge({ value, max, min = 0, label }) {
  const pct = value === null ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));
  const r = 52;
  const c = Math.PI * r;

  return (
    <div className="rp-gauge" role="img" aria-label={`${label}: ${value ?? 'not measured'}`}>
      <svg viewBox="0 0 120 70">
        <path d="M8 62 A52 52 0 0 1 112 62" className="rp-gauge-track" />
        <path d="M8 62 A52 52 0 0 1 112 62" className="rp-gauge-fill" style={{ strokeDasharray: `${c * pct} ${c}` }} />
      </svg>
      <b>{value ?? '–'}</b>
      <span>{label}</span>
    </div>
  );
}

export default function DiagnosticReport({ pathInfo, pathState, onAnalyze, onAddCards, onReview, fresh = false }) {
  const diagnostic = pathState.diagnostic;
  const pathId = pathState.path?.pathId;
  const config = getPath(pathId);
  const mistakes = useMemo(() => mistakesOf(diagnostic), [diagnostic]);
  const cardable = useMemo(() => mistakes.map((m, i) => ({ ...m, key: i })).filter((m) => !m.needsPassage && m.correctText), [mistakes]);
  const [chosen, setChosen] = useState(() => new Set(cardable.map((m) => m.key)));
  const [analysis, setAnalysis] = useState({ state: diagnostic?.analysis ? 'done' : 'idle', error: '', code: '' });
  const [added, setAdded] = useState(null);
  const [adding, setAdding] = useState(false);
  const asked = useRef(false);

  // The coach starts reading as soon as the report opens.
  useEffect(() => {
    if (!diagnostic || diagnostic.analysis || asked.current) return;

    asked.current = true;
    setAnalysis({ state: 'running', error: '' });
    onAnalyze().then((result) => {
      setAnalysis(result?.error ? { state: 'error', error: result.error, code: result.code } : { state: 'done', error: '', code: '' });
      if (!result?.error) trackEvent('coach_analysis', { path: pathId });
    });
  }, [diagnostic, onAnalyze, pathId]);

  if (!diagnostic || !config) {
    return (
      <section className="rp-empty">
        <h1>No diagnostic yet</h1>
        <p>Take a diagnostic on your exam path to get a full report from the AI coach.</p>
        <a className="mq-btn mq-btn-primary" href={pageHref('path')}>
          Go to my exam path
        </a>
      </section>
    );
  }

  const coach = diagnostic.analysis;
  const correct = diagnostic.sections.reduce((sum, s) => sum + (s.correct || 0), 0);
  const total = diagnostic.sections.reduce((sum, s) => sum + (s.total || 0), 0);
  const isSat = config.engine === 'sat';
  const subjectFor = (sectionId) => config.subjects.find((s) => s.id === sectionId)?.cardSubject || 'Mistakes';

  async function addCards() {
    setAdding(true);

    const list = cardable
      .filter((m) => chosen.has(m.key))
      .map((m) => ({
        subject: subjectFor(m.sectionId),
        sectionId: m.sectionId,
        topic: m.topic,
        question: m.passage && !m.needsPassage ? `${m.passage}

${m.question}` : m.question,
        correctAnswer: m.correctText,
        yourAnswer: m.pickedText,
        explain: m.explain,
        distractors: (m.options || []).filter((_, i) => i !== m.correctIndex).slice(0, 4),
      }));
    const result = await onAddCards(list);

    setAdding(false);
    setAdded(result);
    if (!result?.error) trackEvent('report_cards_added', { path: pathId, count: result.added });
  }

  const toggle = (key) =>
    setChosen((current) => {
      const next = new Set(current);

      if (next.has(key)) next.delete(key);
      else next.add(key);

      return next;
    });

  return (
    <div className="rp">
      <header className="rp-hero">
        <div>
          <p className="lp-kicker">{fresh ? 'Your result is in' : 'Diagnostic report'}</p>
          <h1>{config.name}</h1>
          <p className="rp-lead">
            You got <b>{correct}</b> of <b>{total}</b> right.{' '}
            {pathInfo?.readiness !== null && pathInfo?.readiness !== undefined
              ? isSat
                ? `That puts your estimated score at about ${pathInfo.readiness}, against a target of ${pathInfo.target}.`
                : `Your readiness is ${pathInfo.readiness} out of 100, against a target of ${pathInfo.target}.`
              : ''}
          </p>
        </div>
        <Gauge
          value={pathInfo?.readiness ?? null}
          min={isSat ? 400 : 0}
          max={isSat ? 1600 : 100}
          label={isSat ? 'estimated SAT score' : 'readiness'}
        />
      </header>

      <section className="rp-sections" aria-label="Sections">
        {diagnostic.sections.map((s) => {
          const pct = s.total ? Math.round((s.correct / s.total) * 100) : 0;

          return (
            <div key={s.id} className="rp-section">
              <div className="rp-section-top">
                <span>{s.name}</span>
                <b>
                  {s.correct}/{s.total}
                </b>
              </div>
              <div className="rp-bar">
                <span className={pct >= 70 ? 'good' : pct >= 45 ? 'mid' : 'low'} style={{ width: `${Math.max(3, pct)}%` }} />
              </div>
            </div>
          );
        })}
      </section>

      <section className="rp-card rp-coach">
        <h2>
          What your AI coach sees <AiBadge />
        </h2>
        {coach ? (
          <>
            <p className="rp-summary">{coach.summary}</p>
            <div className="rp-two">
              {coach.weaknesses?.length > 0 && (
                <div>
                  <h3>Fix these first</h3>
                  <ul className="rp-list rp-weak">
                    {coach.weaknesses.map((w) => (
                      <li key={w.area}>
                        <b>{w.area}.</b> {w.detail}
                        {w.fix && <span className="rp-fix">How: {w.fix}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {coach.strengths?.length > 0 && (
                <div>
                  <h3>Already working</h3>
                  <ul className="rp-list rp-strong">
                    {coach.strengths.map((s) => (
                      <li key={s.area}>
                        <b>{s.area}.</b> {s.detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {coach.focus?.length > 0 && (
              <>
                <h3>Your next 7 days</h3>
                <ol className="rp-focus">
                  {coach.focus.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ol>
              </>
            )}
          </>
        ) : analysis.state === 'error' && (analysis.code === 'pro' || analysis.code === 'limit') ? (
          <div className="rp-upsell">
            <p>
              <b>{analysis.code === 'pro' ? 'You have used your free AI coach analysis.' : 'You have used your AI for today.'}</b>{' '}
              {analysis.error}
            </p>
            <ul>
              <li>An AI coach analysis after every diagnostic and mock test</li>
              <li>50 AI uses a day instead of 5</li>
              <li>The whole practice library and full practice tests</li>
            </ul>
            <a className="mq-btn mq-btn-primary" href={pageHref('pro')}>
              See Pro, from {taka(priceOf(PRO.offers[0]).now)}
            </a>
            <p className="rp-muted">Your score, every mistake and your review cards below stay free.</p>
          </div>
        ) : analysis.state === 'error' ? (
          <div className="rp-coach-wait">
            <p>{analysis.error}</p>
            <button
              type="button"
              className="mq-btn mq-btn-ghost"
              onClick={() => {
                setAnalysis({ state: 'running', error: '' });
                onAnalyze().then((r) => setAnalysis(r?.error ? { state: 'error', error: r.error } : { state: 'done', error: '' }));
              }}
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="rp-coach-wait" role="status">
            <span className="pay-spinner" aria-hidden="true" />
            <p>Your coach is reading every answer and working out what to fix first. This takes about 20 seconds.</p>
            <div className="rp-skeleton" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          </div>
        )}
      </section>

      <section className="rp-card">
        <div className="rp-mistakes-head">
          <div>
            <h2>
              {mistakes.length === 0 ? 'No mistakes. Impressive.' : `Your ${mistakes.length} ${mistakes.length === 1 ? 'mistake' : 'mistakes'}, and the right answers`}
            </h2>
            {cardable.length > 0 && <p className="rp-muted">Ticked ones become review cards. Untick any you already understand.</p>}
          </div>
        </div>

        <ol className="rp-mistakes">
          {mistakes.map((m, i) => {
            const canCard = !m.needsPassage && m.correctText;

            return (
              <li key={`${m.sectionId}-${i}`} className="rp-mistake">
                <div className="rp-mistake-top">
                  <span className="rp-tag">
                    {m.sectionName} · {m.topic}
                  </span>
                  {canCard && (
                    <label className="rp-pick">
                      <input type="checkbox" checked={chosen.has(i)} disabled={Boolean(added && !added.error)} onChange={() => toggle(i)} />
                      Make a card
                    </label>
                  )}
                </div>
                {m.passage && !m.needsPassage && <p className="rp-passage">{m.passage}</p>}
                <div className="rp-q">
                  <RichText text={m.question} graphs={false} />
                </div>
                {m.options ? (
                  <ul className="rp-options">
                    {m.options.map((o, oi) => (
                      <li key={`${o}-${oi}`} className={oi === m.correctIndex ? 'right' : oi === m.pickedIndex ? 'wrong' : ''}>
                        <span>{LETTERS[oi]}</span>
                        <RichText text={o} graphs={false} />
                        {oi === m.correctIndex && <em>correct</em>}
                        {oi === m.pickedIndex && <em>your answer</em>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="rp-answer">
                    <span className="wrong">Your answer: {m.pickedText || 'skipped'}</span>
                    <span className="right">Correct: {m.correctText}</span>
                  </p>
                )}
                {m.pickedIndex === null && m.options && <p className="rp-muted">You skipped this one.</p>}
                {m.explain && (
                  <div className="rp-explain">
                    <RichText text={m.explain} graphs={false} />
                  </div>
                )}
                {m.needsPassage && <p className="rp-muted">Reading question: it needs the passage, so it stays here instead of becoming a card.</p>}
              </li>
            );
          })}
        </ol>
      </section>

      {cardable.length > 0 && (
        <section className="rp-card rp-why">
          <h2>Never get these wrong again</h2>
          <p className="rp-muted">
            Reading the right answer once feels like learning, but most of it is gone within days. Two habits fix that, and Mnemoq does both for you:
          </p>
          <div className="rp-steps">
            <div>
              <b>1. Active recall</b>
              <p>Each card asks the question first. You try to remember before you see the answer, and that effort is what makes it stick.</p>
            </div>
            <div>
              <b>2. Spaced repetition</b>
              <p>Get it wrong and it comes back in 10 minutes. Get it right and the gap grows each time, so you review it just as you are about to forget.</p>
            </div>
          </div>
          <ol className="rp-timeline" aria-label="When a card comes back">
            {['Today', '1 day', '2 days', '4 days', '8 days', '16 days'].map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
          <div className="rp-cta">
            {added && !added.error ? (
              <>
                <p className="rp-done" role="status">
                  {added.added} cards saved. Your first review is ready now.
                </p>
                <button type="button" className="mq-btn mq-btn-primary mq-btn-lg" onClick={onReview}>
                  Start my first review →
                </button>
              </>
            ) : (
              <button type="button" className="mq-btn mq-btn-primary mq-btn-lg" disabled={adding || chosen.size === 0} onClick={addCards}>
                {adding ? 'Saving…' : `Add ${chosen.size} ${chosen.size === 1 ? 'mistake' : 'mistakes'} as review cards`}
              </button>
            )}
            {added?.error && <p className="pro-message">{added.error}</p>}
          </div>
        </section>
      )}

      <p className="rp-foot">
        <a href={pageHref('path')}>Go to my {config.short} path</a> for your plan, practice and mock tests.
      </p>
    </div>
  );
}
