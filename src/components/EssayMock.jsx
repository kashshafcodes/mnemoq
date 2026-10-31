import { useEffect, useRef, useState } from 'react';
import { CoachError, requestEssayGrade } from '../coachApi';
import { MIN_ESSAY_WORDS, countWords } from '../diagnosticScore';
import { formatClock } from '../mocks';
import { NO_SUGGEST } from '../noSuggest';
import { computeReadiness } from '../readiness';
import AiBadge from './AiBadge';
import MockReport from './MockReport';

// The timed essay mock: choose one of two prompts, write, and the AI marks it.

export default function EssayMock({ title, prompts, minutes, source, pathId, diagnostic, reviews, mocks, onSaveMock, onQuit, children }) {
  const [phase, setPhase] = useState('choose'); // choose | write | marking | result | error
  const [prompt, setPrompt] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState(null);
  const startedRef = useRef(0);
  const textRef = useRef('');
  const doneRef = useRef(false);
  const limit = minutes * 60;

  textRef.current = text;

  const words = countWords(text);
  const remaining = phase === 'write' ? Math.max(0, limit - (now - startedRef.current) / 1000) : limit;

  async function submit() {
    if (doneRef.current) return;

    doneRef.current = true;
    setPhase('marking');
    setError('');

    const essayText = textRef.current;
    const seconds = Math.round((Date.now() - startedRef.current) / 1000);

    if (countWords(essayText) < MIN_ESSAY_WORDS) {
      setError(`An essay needs at least ${MIN_ESSAY_WORDS} words to be marked, so this attempt was not recorded. Try again when you are ready.`);
      setPhase('error');
      return;
    }

    try {
      const graded = await requestEssayGrade(prompt, essayText);
      const essay = graded.essay;
      const section = { id: 'essay', name: 'Essay', correct: essay.score, total: 100, topics: [], missed: [], essay };
      const record = { pathId, sections: [section], correct: essay.score, total: 100, seconds, limitSeconds: limit, source };
      const before = computeReadiness(pathId, diagnostic, reviews, new Date(), mocks)?.overall ?? null;
      const saved = await onSaveMock(record);
      const after = computeReadiness(pathId, diagnostic, reviews, new Date(), [{ ...record, createdAt: new Date() }, ...mocks])?.overall ?? null;

      setResult({ record, before, after, saveError: saved?.error || '' });
      setPhase('result');
    } catch (caught) {
      doneRef.current = false;
      setError(caught instanceof CoachError ? caught.message : 'Something went wrong. Try again.');
      setPhase('error');
    }
  }

  useEffect(() => {
    if (phase !== 'write') return undefined;

    const timer = setInterval(() => {
      setNow(Date.now());

      if ((Date.now() - startedRef.current) / 1000 >= limit) submit();
    }, 500);

    return () => clearInterval(timer);
    // submit reads the latest text from a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const head = (
    <header className="diag-head">
      <div>
        <p className="eyebrow">MOCK TEST</p>
        <h2>
          {title} <AiBadge>AI-marked</AiBadge>
        </h2>
      </div>
      {(phase === 'choose' || phase === 'write' || phase === 'error') && (
        <button
          type="button"
          className="text-link"
          onClick={() => {
            if (phase !== 'write' || window.confirm('Leave this test? Your essay will not be saved.')) onQuit();
          }}
        >
          {phase === 'write' ? 'Quit' : 'Back'}
        </button>
      )}
    </header>
  );

  if (phase === 'result') {
    return (
      <section className="diag mock">
        {head}
        <MockReport title={title} record={result.record} before={result.before} after={result.after} saveError={result.saveError}>
          {children}
        </MockReport>
      </section>
    );
  }

  if (phase === 'marking') {
    return (
      <section className="diag mock">
        {head}
        <div className="diag-card diag-wait" role="status">
          <span className="ai-dots" aria-hidden="true">
            <i /><i /><i />
          </span>
          <h3>The AI is marking your essay</h3>
          <p>This takes a few seconds. Please keep this page open.</p>
        </div>
      </section>
    );
  }

  if (phase === 'choose' || phase === 'error') {
    return (
      <section className="diag mock">
        {head}
        <div className="diag-card">
          <h3>Choose one topic</h3>
          <p className="diag-note">
            You have {minutes} minutes. Write about 250 words. The AI marks content, organisation, language and grammar.
          </p>
          {phase === 'error' && (
            <p className="diag-error" role="alert">
              {error}
            </p>
          )}
          <div className="essay-prompts">
            {prompts.map((p) => (
              <button
                key={p}
                type="button"
                className="path-choice"
                onClick={() => {
                  doneRef.current = false;
                  setPrompt(p);
                  setText('');
                  startedRef.current = Date.now();
                  setNow(Date.now());
                  setPhase('write');
                }}
              >
                <strong>{p}</strong>
                <span>Start the {minutes}-minute timer with this topic</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="diag mock">
      {head}
      <div className="mock-bar">
        <span>{words} words</span>
        <b className={remaining <= 120 ? 'mock-clock low' : 'mock-clock'} role="timer" aria-label="Time left">
          {formatClock(remaining)}
        </b>
      </div>
      <div className="diag-card">
        <h3>{prompt}</h3>
        <label htmlFor="mock-essay" className="sr-only">
          Your essay
        </label>
        <textarea
          id="mock-essay"
          className="diag-essay"
          rows={14}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Start writing here..."
          {...NO_SUGGEST}
        />
        <p className={words >= MIN_ESSAY_WORDS ? 'diag-count ok' : 'diag-count'}>
          {words} {words === 1 ? 'word' : 'words'}
          {words < MIN_ESSAY_WORDS && ` · at least ${MIN_ESSAY_WORDS} to be marked`}
        </p>
        <div className="diag-actions">
          <button type="button" className="qa-primary" disabled={words < MIN_ESSAY_WORDS} onClick={submit}>
            Submit for marking
          </button>
        </div>
      </div>
    </section>
  );
}
