import { useEffect, useRef, useState } from 'react';
import { requestSuggestions } from '../aiSuggest';
import { holdPosition } from '../holdPosition';

// "Suggest with AI" for one card: a memory-hook draft, the concept being
// tested, and similar multiple-choice questions. Everything is a draft. Nothing
// is saved unless the person taps Use or Add.

export function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 3.5 13.9 9l5.6 1.9-5.6 1.9L12 18.5l-1.9-5.7L4.5 10.9 10.1 9 12 3.5Z" />
      <path d="M19 3v3M17.5 4.5h3" />
    </svg>
  );
}

export default function AiSuggestPanel({ input, hookIsEmpty, onUseHook, onAddCard, onClose }) {
  const [status, setStatus] = useState('loading'); // loading | done | error
  // Parts arrive one at a time: the hook first, then the questions.
  const [data, setData] = useState({ concept: '', hook: '', similar: [], remaining: null, missing: [] });
  const [got, setGot] = useState({ hook: false, similar: false });
  const [error, setError] = useState(null);
  const [added, setAdded] = useState(() => new Set());
  const [busyIndex, setBusyIndex] = useState(null);
  const [addError, setAddError] = useState('');
  const [hookUsed, setHookUsed] = useState(false);
  const startedRef = useRef(false);

  async function run() {
    setStatus('loading');
    setError(null);
    setGot({ hook: false, similar: false });
    setData({ concept: '', hook: '', similar: [], remaining: null, missing: [] });
    setAdded(new Set());
    setHookUsed(false);

    try {
      const final = await requestSuggestions(input, (part) => {
        if (part.type === 'hook') {
          setData((current) => ({ ...current, concept: part.concept, hook: part.hook }));
          setGot((current) => ({ ...current, hook: true }));
        } else if (part.type === 'similar') {
          setData((current) => ({ ...current, similar: part.similar }));
          setGot((current) => ({ ...current, similar: true }));
        }
      });

      setData((current) => ({ ...current, remaining: final.remaining, missing: final.missing || [] }));
      setStatus('done');
    } catch (caught) {
      setError({ message: caught?.message || 'Something went wrong.', code: caught?.code });
      setStatus('error');
    }
  }

  // One request per opening, even if React runs this effect twice in development.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addOne(index, button) {
    const item = data.similar[index];

    if (added.has(index) || busyIndex !== null) return;

    const releasePosition = holdPosition(button);

    setBusyIndex(index);
    setAddError('');

    const result = await onAddCard({
      question: item.question,
      correctAnswer: item.correctAnswer,
      distractors: item.wrongAnswers,
    });

    setBusyIndex(null);

    if (result?.error) {
      setAddError(`Could not add: ${result.error}`);
      releasePosition();
      return false;
    }

    setAdded((current) => new Set(current).add(index));
    releasePosition();
    return true;
  }

  async function addAll(event) {
    const button = event?.currentTarget;

    for (let index = 0; index < data.similar.length; index += 1) {
      if (added.has(index)) continue;
      // Stop at the first failure so the message stays accurate.
      // eslint-disable-next-line no-await-in-loop
      if ((await addOne(index, button)) === false) return;
    }
  }

  const similar = data?.similar || [];
  const notAdded = similar.filter((_, index) => !added.has(index)).length;
  const canRetry = error && !['limit', 'config', 'auth'].includes(error.code);

  return (
    <section className="ai-panel" aria-label="AI suggestions" aria-live="polite">
      <header>
        <h3>
          <SparkIcon /> AI suggestions
        </h3>
        <button type="button" className="text-link" onClick={onClose}>
          Close
        </button>
      </header>

      {status === 'loading' && !got.hook && !got.similar && (
        <p className="ai-loading" role="status">
          <span className="ai-dots" aria-hidden="true">
            <i /><i /><i />
          </span>
          Thinking about your card...
        </p>
      )}

      {status === 'error' && (
        <div className="ai-error" role="alert">
          <p>{error.message}</p>
          {canRetry && (
            <button type="button" className="ghost-button" onClick={run}>
              Try again
            </button>
          )}
        </div>
      )}

      {(status === 'done' || got.hook || got.similar) && (
        <>
          <p className="ai-note">AI draft. It can be wrong, so check it before you save.</p>

          {!input.wrong && got.hook && (
            <p className="ai-tip">
              Tip: next time add what you answered. The hook can then explain why it was not that.
            </p>
          )}

          {data.concept && (
            <p className="ai-concept">
              <span className="ai-label">Tests</span> {data.concept}
            </p>
          )}

          {data.hook && (
            <div className="ai-block">
              <p className="ai-label">Memory hook</p>
              <p className="ai-hook">{data.hook}</p>
              <button
                type="button"
                className="ghost-button"
                disabled={hookUsed}
                onClick={() => {
                  onUseHook(data.hook);
                  setHookUsed(true);
                }}
              >
                {hookUsed ? 'Added to your card' : hookIsEmpty ? 'Use this hook' : 'Replace my hook with this'}
              </button>
            </div>
          )}

          {status === 'loading' && got.hook && !got.similar && (
            <p className="ai-loading" role="status">
              <span className="ai-dots" aria-hidden="true">
                <i /><i /><i />
              </span>
              Writing practice questions...
            </p>
          )}

          {similar.length > 0 && (
            <div className="ai-block">
              <div className="ai-block-head">
                <p className="ai-label">Similar questions</p>
                {notAdded > 1 && (
                  <button type="button" className="text-link" disabled={busyIndex !== null} onClick={addAll}>
                    Add all {notAdded}
                  </button>
                )}
              </div>

              <ul className="ai-similar">
                {similar.map((item, index) => (
                  <li key={item.question} className={added.has(index) ? 'is-added' : ''}>
                    <p className="ai-kind">{item.kind === 'related' ? 'Related topic' : 'Same idea, new angle'}</p>
                    <p className="ai-q">{item.question}</p>
                    <p className="ai-answer">
                      <span aria-hidden="true">✓</span> {item.correctAnswer}
                    </p>
                    <p className="ai-others">Wrong options: {item.wrongAnswers.join(' · ')}</p>
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={added.has(index) || busyIndex !== null}
                      onClick={(event) => addOne(index, event.currentTarget)}
                    >
                      {added.has(index) ? 'Added ✓' : busyIndex === index ? 'Adding...' : 'Add as a card'}
                    </button>
                  </li>
                ))}
              </ul>
              {addError && <p className="qa-message qa-error" role="alert">{addError}</p>}
            </div>
          )}

          {status === 'done' && data.missing.length > 0 && (
            <div className="ai-retry">
              <p className="ai-note">
                {data.missing.includes('hook') && data.missing.includes('similar')
                  ? 'The suggestions'
                  : data.missing.includes('hook')
                    ? 'The memory hook'
                    : 'The practice questions'}{' '}
                could not be written this time.
              </p>
              <button type="button" className="ghost-button" onClick={run}>
                Try again
              </button>
            </div>
          )}

          {typeof data.remaining === 'number' && (
            <p className="ai-footer">
              {data.remaining} suggestion{data.remaining === 1 ? '' : 's'} left today
            </p>
          )}
        </>
      )}
    </section>
  );
}
