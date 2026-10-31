import { useEffect, useMemo, useRef, useState } from 'react';
import { CoachError, requestMock } from '../coachApi';
import { missedAsCards, scoreSections } from '../diagnosticScore';
import { LETTERS, MOCK_SECTIONS, SOURCES, assemblePaper, formatClock, maxFor, sectionName, sectionsNeedingAi, suggestMinutes } from '../mocks';
import { computeReadiness } from '../readiness';
import AiBadge from './AiBadge';
import QuestionBank from './QuestionBank';

// The mock test: build it (sections, source, length, timer), sit it, see results.
//   build -> loading -> run -> result

export default function Mock({
  pathId,
  path,
  diagnostic,
  reviews,
  mocks,
  bank,
  setup,
  onSaveMock,
  onAddBank,
  onDeleteBank,
  onAddCards,
  onClose,
}) {
  const sectionIds = MOCK_SECTIONS.filter((id) => path.subjects.some((s) => s.id === id));
  const [phase, setPhase] = useState('build'); // build | loading | error | run | result
  const [source, setSource] = useState('ai');
  const [picked, setPicked] = useState(() => Object.fromEntries(sectionIds.map((id) => [id, true])));
  const [counts, setCounts] = useState({});
  const [timerOn, setTimerOn] = useState(true);
  const [minutes, setMinutes] = useState(null); // null = use the suggestion
  const [error, setError] = useState('');
  const [paper, setPaper] = useState([]);
  const [answers, setAnswers] = useState({});
  const [flags, setFlags] = useState({});
  const [cur, setCur] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState(null);
  const [added, setAdded] = useState(0);
  const [adding, setAdding] = useState(false);
  const startedRef = useRef(0);
  const limitRef = useRef(null);
  const answersRef = useRef({});
  const doneRef = useRef(false);
  const topRef = useRef(null);

  answersRef.current = answers;

  const countFor = (id) => Math.min(counts[id] ?? maxFor(id, source, bank), maxFor(id, source, bank));
  const choices = sectionIds.filter((id) => picked[id] && maxFor(id, source, bank) > 0).map((id) => ({ id, count: countFor(id) }));
  const totalQuestions = choices.reduce((sum, c) => sum + c.count, 0);
  const suggested = suggestMinutes(totalQuestions);
  const chosenMinutes = minutes ?? suggested;

  const flat = useMemo(() => paper.flatMap((section) => section.questions.map((q) => ({ section, q }))), [paper]);
  const remaining = limitRef.current ? Math.max(0, limitRef.current - (now - startedRef.current) / 1000) : null;

  function toTop() {
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  async function start() {
    setError('');

    const needAi = sectionsNeedingAi(choices, source, bank);
    let aiSections = [];

    if (needAi.length > 0) {
      setPhase('loading');

      try {
        aiSections = (await requestMock(needAi, pathId)).sections;
      } catch (caught) {
        setError(caught instanceof CoachError ? caught.message : 'Something went wrong. Try again.');
        setPhase('error');
        return;
      }
    }

    const built = assemblePaper(pathId, choices, source, bank, aiSections);

    if (built.length === 0) {
      setError('There were no questions to build the test from. Add some of your own, or use AI-written questions.');
      setPhase('error');
      return;
    }

    setPaper(built);
    setAnswers({});
    setFlags({});
    setCur(0);
    setConfirming(false);
    doneRef.current = false;
    startedRef.current = Date.now();
    limitRef.current = timerOn ? chosenMinutes * 60 : null;
    setNow(Date.now());
    setPhase('run');
    toTop();
  }

  async function submit() {
    if (doneRef.current) return;

    doneRef.current = true;

    const seconds = Math.round((Date.now() - startedRef.current) / 1000);
    const scored = scoreSections(paper, answersRef.current);
    const correct = scored.reduce((sum, s) => sum + s.correct, 0);
    const total = scored.reduce((sum, s) => sum + s.total, 0);
    const record = { pathId, sections: scored, correct, total, seconds, limitSeconds: limitRef.current, source };
    const before = computeReadiness(pathId, diagnostic, reviews, new Date(), mocks)?.overall ?? null;
    const saved = await onSaveMock(record);
    const after = computeReadiness(pathId, diagnostic, reviews, new Date(), [{ ...record, createdAt: new Date() }, ...mocks])?.overall ?? null;

    setResult({ ...record, before, after, saveError: saved?.error || '' });
    setAdded(0);
    setPhase('result');
    toTop();
  }

  useEffect(() => {
    if (phase !== 'run') return undefined;

    const timer = setInterval(() => {
      setNow(Date.now());

      if (limitRef.current && (Date.now() - startedRef.current) / 1000 >= limitRef.current) submit();
    }, 500);

    return () => clearInterval(timer);
    // submit reads everything it needs from refs and the current paper.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, paper]);

  const missedCards = useMemo(() => (result ? missedAsCards({ sections: result.sections }) : []), [result]);

  async function addMissed() {
    setAdding(true);

    const outcome = await onAddCards(missedCards);

    setAdding(false);
    setAdded(outcome?.added || 0);
  }

  const head = (
    <header className="diag-head" ref={topRef}>
      <div>
        <p className="eyebrow">MOCK TEST</p>
        <h2>
          {path.name} <AiBadge>AI mock test</AiBadge>
        </h2>
      </div>
      {phase !== 'loading' && (
        <button type="button" className="text-link" onClick={onClose}>
          {phase === 'result' ? 'Done' : 'Cancel'}
        </button>
      )}
    </header>
  );

  if (phase === 'build' || phase === 'error') {
    return (
      <section className="diag mock">
        {head}

        {setup && (
          <p className="path-notice" role="status">
            Run <code>supabase/stage3.sql</code> in Supabase to save your mock results and question bank. You can still sit a
            test, but nothing will be saved.
          </p>
        )}

        <div className="diag-card">
          <h3>Build your mock test</h3>
          <p className="diag-note">
            We suggest every section, the length the AI can write, and about {`1.2`} minutes a question. Change anything you
            like. The essay is not part of mock tests yet.
          </p>

          <fieldset className="mock-fields">
            <legend>Where the questions come from</legend>
            {SOURCES.map((s) => (
              <label key={s.id} className="mock-radio">
                <input type="radio" name="mock-source" checked={source === s.id} onChange={() => setSource(s.id)} />
                <span>
                  <b>{s.label}</b> <small>{s.hint}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="mock-fields">
            <legend>Sections</legend>
            {sectionIds.map((id) => {
              const max = maxFor(id, source, bank);

              return (
                <div key={id} className="mock-section">
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(picked[id]) && max > 0}
                      disabled={max === 0}
                      onChange={(e) => setPicked({ ...picked, [id]: e.target.checked })}
                    />{' '}
                    <b>{sectionName(pathId, id)}</b>
                    <small> {max === 0 ? ' none available with this source' : ` up to ${max}`}</small>
                  </label>
                  {picked[id] && max > 0 && (
                    <label className="mock-count">
                      <input
                        type="range"
                        min={Math.min(3, max)}
                        max={max}
                        value={countFor(id)}
                        onChange={(e) => setCounts({ ...counts, [id]: Number(e.target.value) })}
                        aria-label={`Questions in ${sectionName(pathId, id)}`}
                      />
                      <b>{countFor(id)}</b>
                    </label>
                  )}
                </div>
              );
            })}
          </fieldset>

          <fieldset className="mock-fields">
            <legend>Timer</legend>
            <label>
              <input type="checkbox" checked={timerOn} onChange={(e) => setTimerOn(e.target.checked)} /> Use a timer
            </label>
            {timerOn && (
              <label className="mock-count">
                <input
                  type="number"
                  min="1"
                  max="240"
                  value={chosenMinutes}
                  onChange={(e) => setMinutes(Math.min(240, Math.max(1, Number(e.target.value) || 1)))}
                  aria-label="Minutes"
                />{' '}
                minutes {minutes !== null && minutes !== suggested && <button type="button" className="text-link" onClick={() => setMinutes(null)}>Use suggested ({suggested})</button>}
              </label>
            )}
          </fieldset>

          {phase === 'error' && (
            <p className="diag-error" role="alert">
              {error}
            </p>
          )}

          <div className="diag-actions">
            <button type="button" className="qa-primary" disabled={totalQuestions === 0} onClick={start}>
              Start the test · {totalQuestions} {totalQuestions === 1 ? 'question' : 'questions'}
            </button>
            {source !== 'mine' && <span className="diag-count">The AI writes the questions when you start. This can take up to a minute.</span>}
          </div>

          <QuestionBank pathId={pathId} bank={bank} onAdd={onAddBank} onDelete={onDeleteBank} />
        </div>
      </section>
    );
  }

  if (phase === 'loading') {
    return (
      <section className="diag mock">
        {head}
        <div className="diag-card diag-wait" role="status">
          <span className="ai-dots" aria-hidden="true">
            <i /><i /><i />
          </span>
          <h3>The AI is writing your mock test</h3>
          <p>It writes the questions, then checks every answer key. Please keep this page open.</p>
        </div>
      </section>
    );
  }

  if (phase === 'run') {
    const item = flat[cur];
    const answeredCount = flat.filter((x) => Number.isInteger(answers[x.q.id])).length;
    const key = item.q.id;
    const showPassage = Boolean(item.section.passage);
    const low = remaining !== null && remaining <= 300;

    return (
      <section className="diag mock">
        {head}

        <div className="mock-bar">
          <span>
            Question {cur + 1} of {flat.length} · {item.section.name}
          </span>
          {remaining !== null ? (
            <b className={low ? 'mock-clock low' : 'mock-clock'} role="timer" aria-label="Time left">
              {formatClock(remaining)}
            </b>
          ) : (
            <b className="mock-clock">{formatClock((now - startedRef.current) / 1000)}</b>
          )}
        </div>

        <div className="diag-card">
          {showPassage && (
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
              const k = x.q.id;
              const cls = ['mock-dot', Number.isInteger(answers[k]) ? 'answered' : '', flags[k] ? 'flagged' : '', i === cur ? 'current' : '']
                .filter(Boolean)
                .join(' ');

              return (
                <button key={k} type="button" className={cls} onClick={() => setCur(i)} aria-label={`Question ${i + 1}`}>
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
              <span>
                {answeredCount < flat.length
                  ? `${flat.length - answeredCount} unanswered. Submit anyway?`
                  : 'Submit your test?'}
              </span>
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

  // result
  const pct = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0;
  const timedOut = result.limitSeconds && result.seconds >= result.limitSeconds - 1;

  return (
    <section className="diag mock">
      {head}

      <div className="diag-card">
        <h3>
          {result.correct} of {result.total} correct · {pct}%
        </h3>
        <p className="diag-note">
          Time: {formatClock(result.seconds)}
          {result.limitSeconds ? ` of ${formatClock(result.limitSeconds)}${timedOut ? ' (time ran out, your answers were submitted)' : ''}` : ''}
        </p>
        {result.saveError && <p className="diag-error">Your result could not be saved: {result.saveError}</p>}
        {result.before !== null && result.after !== null && result.after !== result.before && (
          <p className="path-fix">
            Your readiness moved from {result.before} to <b>{result.after}</b>.
          </p>
        )}

        <ul className="path-sections">
          {result.sections.map((s) => {
            const p = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;

            return (
              <li key={s.id}>
                <div className="path-section-head">
                  <strong>{s.name}</strong>
                  <b className="path-score">
                    {s.correct}/{s.total}
                  </b>
                </div>
                <div className="path-meter" aria-hidden="true">
                  <span style={{ width: `${p}%` }} />
                </div>
                <p className="path-detail">
                  {s.topics
                    .filter((t) => t.correct < t.total)
                    .map((t) => `${t.topic} ${t.correct}/${t.total}`)
                    .join(' · ') || 'No weak topics here.'}
                </p>
              </li>
            );
          })}
        </ul>
      </div>

      {result.sections.some((s) => s.missed.length > 0) && (
        <div className="diag-card">
          <h3>What you missed</h3>
          <ul className="mock-missed">
            {result.sections.flatMap((s) =>
              s.missed.map((m) => (
                <li key={`${s.id}-${m.question}`}>
                  <p>{m.question}</p>
                  <small>
                    You: {m.picked === null ? 'no answer' : `${LETTERS[m.picked]}) ${m.options[m.picked]}`} · Correct: {LETTERS[m.correct]}) {m.options[m.correct]}
                  </small>
                </li>
              ))
            )}
          </ul>
          {missedCards.length > 0 && (
            <button type="button" className="qa-primary" disabled={adding || added > 0} onClick={addMissed}>
              {added > 0 ? `${added} added to your cards` : adding ? 'Adding...' : `Add ${missedCards.length} missed ${missedCards.length === 1 ? 'question' : 'questions'} to my cards`}
            </button>
          )}
        </div>
      )}

      <div className="diag-actions">
        <button type="button" className="qa-primary" onClick={() => setPhase('build')}>
          Build another test
        </button>
        <button type="button" className="ghost-button" onClick={onClose}>
          Back to my path
        </button>
      </div>
    </section>
  );
}
