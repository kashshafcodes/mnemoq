import { useEffect, useMemo, useRef, useState } from 'react';
import { scoreSections } from '../diagnosticScore';
import { LETTERS, formatClock } from '../mocks';
import { computeReadiness } from '../readiness';
import MockReport from './MockReport';

// Sitting one mock test: the clock, the questions, then the report.
//   paper: [{ id, name, passage, questions: [{ id, question, options, answer, topic, explain }] }]

export default function MockSession({
  title,
  paper,
  limitSeconds,
  source,
  pathId,
  diagnostic,
  reviews,
  mocks,
  onSaveMock,
  onAddCards,
  onQuit,
  children,
}) {
  const [phase, setPhase] = useState('run'); // run | result
  const [answers, setAnswers] = useState({});
  const [flags, setFlags] = useState({});
  const [cur, setCur] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState(null);
  const startedRef = useRef(Date.now());
  const answersRef = useRef({});
  const doneRef = useRef(false);
  const topRef = useRef(null);

  answersRef.current = answers;

  const flat = useMemo(() => paper.flatMap((section) => section.questions.map((q) => ({ section, q }))), [paper]);
  const remaining = limitSeconds ? Math.max(0, limitSeconds - (now - startedRef.current) / 1000) : null;

  function toTop() {
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  async function submit() {
    if (doneRef.current) return;

    doneRef.current = true;

    const seconds = Math.round((Date.now() - startedRef.current) / 1000);
    const scored = scoreSections(paper, answersRef.current);
    const correct = scored.reduce((sum, s) => sum + s.correct, 0);
    const total = scored.reduce((sum, s) => sum + s.total, 0);
    const record = { pathId, sections: scored, correct, total, seconds, limitSeconds, source };
    const before = computeReadiness(pathId, diagnostic, reviews, new Date(), mocks)?.overall ?? null;
    const saved = await onSaveMock(record);
    const after = computeReadiness(pathId, diagnostic, reviews, new Date(), [{ ...record, createdAt: new Date() }, ...mocks])?.overall ?? null;

    setResult({ record, before, after, saveError: saved?.error || '' });
    setPhase('result');
    toTop();
  }

  useEffect(() => {
    if (phase !== 'run') return undefined;

    const timer = setInterval(() => {
      setNow(Date.now());

      if (limitSeconds && (Date.now() - startedRef.current) / 1000 >= limitSeconds) submit();
    }, 500);

    return () => clearInterval(timer);
    // submit reads everything it needs from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const head = (
    <header className="diag-head" ref={topRef}>
      <div>
        <p className="eyebrow">MOCK TEST</p>
        <h2>{title}</h2>
      </div>
      {phase === 'run' && (
        <button
          type="button"
          className="text-link"
          onClick={() => {
            if (window.confirm('Leave this test? Your answers will not be saved.')) onQuit();
          }}
        >
          Quit
        </button>
      )}
    </header>
  );

  if (phase === 'result') {
    return (
      <section className="diag mock">
        {head}
        <MockReport title={title} record={result.record} before={result.before} after={result.after} saveError={result.saveError} onAddCards={onAddCards}>
          {children}
        </MockReport>
      </section>
    );
  }

  const item = flat[cur];
  const key = item.q.id;
  const answeredCount = flat.filter((x) => Number.isInteger(answers[x.q.id])).length;
  const low = remaining !== null && remaining <= 300;

  return (
    <section className="diag mock">
      {head}

      <div className="mock-bar">
        <span>
          Question {cur + 1} of {flat.length} · {item.section.name}
        </span>
        <b className={low ? 'mock-clock low' : 'mock-clock'} role="timer" aria-label="Time left">
          {formatClock(remaining ?? (now - startedRef.current) / 1000)}
        </b>
      </div>

      <div className="diag-card">
        {item.section.passage && (
          <blockquote className="diag-passage">
            <p>{item.section.passage}</p>
          </blockquote>
        )}

        <p className="diag-q">
          <span>{cur + 1}.</span> {item.q.question}
        </p>
        <div className="diag-options" role="radiogroup" aria-label={`Question ${cur + 1}`}>
          {item.q.options.map((option, oi) => (
            <button
              key={`${oi}-${option}`}
              type="button"
              role="radio"
              aria-checked={answers[key] === oi}
              className={answers[key] === oi ? 'diag-option selected' : 'diag-option'}
              onClick={() => setAnswers((current) => ({ ...current, [key]: oi }))}
            >
              <span className="diag-letter" aria-hidden="true">
                {LETTERS[oi]}
              </span>
              <span className="diag-text">{option}</span>
            </button>
          ))}
        </div>

        <div className="diag-actions">
          <button type="button" className="ghost-button" disabled={cur === 0} onClick={() => setCur(cur - 1)}>
            Back
          </button>
          <button type="button" className="ghost-button" onClick={() => setFlags({ ...flags, [key]: !flags[key] })}>
            {flags[key] ? 'Unflag' : 'Flag for later'}
          </button>
          {cur + 1 < flat.length ? (
            <button type="button" className="qa-primary" onClick={() => setCur(cur + 1)}>
              Next
            </button>
          ) : (
            <button type="button" className="qa-primary" onClick={() => setConfirming(true)}>
              Finish
            </button>
          )}
        </div>
      </div>

      <div className="diag-card">
        <div className="mock-palette" role="group" aria-label="Jump to a question">
          {flat.map((x, i) => {
            const cls = ['mock-dot', Number.isInteger(answers[x.q.id]) ? 'answered' : '', flags[x.q.id] ? 'flagged' : '', i === cur ? 'current' : '']
              .filter(Boolean)
              .join(' ');

            return (
              <button key={x.q.id} type="button" className={cls} onClick={() => setCur(i)} aria-label={`Question ${i + 1}`}>
                {i + 1}
              </button>
            );
          })}
        </div>
        <p className="diag-count">
          {answeredCount} of {flat.length} answered · purple = answered, amber = flagged
        </p>
        {confirming ? (
          <div className="diag-actions">
            <span>{answeredCount < flat.length ? `${flat.length - answeredCount} unanswered. Submit anyway?` : 'Submit your test?'}</span>
            <button type="button" className="qa-primary" onClick={submit}>
              Yes, submit
            </button>
            <button type="button" className="ghost-button" onClick={() => setConfirming(false)}>
              Keep going
            </button>
          </div>
        ) : (
          <button type="button" className="ghost-button" onClick={() => setConfirming(true)}>
            Submit test
          </button>
        )}
      </div>
    </section>
  );
}
