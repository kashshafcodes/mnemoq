import { useEffect, useRef, useState } from 'react';
import { requestSuggestions } from '../aiSuggest';

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
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [added, setAdded] = useState(() => new Set());
  const [busyIndex, setBusyIndex] = useState(null);
  const [addError, setAddError] = useState('');
  const [hookUsed, setHookUsed] = useState(false);
  const startedRef = useRef(false);

  async function run() {
    setStatus('loading');
    setError(null);

    try {
      const result = await requestSuggestions(input);
      setData(result);
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

  async function addOne(index) {
    const item = data.similar[index];

    if (added.has(index) || busyIndex !== null) return;

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
      return false;
    }

    setAdded((current) => new Set(current).add(index));
    return true;
  }

  async function addAll() {
    for (let index = 0; index < data.similar.length; index += 1) {
      if (added.has(index)) continue;
      // Stop at the first failure so the message stays accurate.
      // eslint-disable-next-line no-await-in-loop
      if ((await addOne(index)) === false) return;
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

      {status === 'loading' && (
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

      {status === 'done' && (
        <>
          <p className="ai-note">AI draft. It can be wrong, so check it before you save.</p>

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
                    <p className="ai-q">{item.question}</p>
                    <p className="ai-answer">
                      <span aria-hidden="true">✓</span> {item.correctAnswer}
                    </p>
                    <p className="ai-others">Wrong options: {item.wrongAnswers.join(' · ')}</p>
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={added.has(index) || busyIndex !== null}
                      onClick={() => addOne(index)}
                    >
                      {added.has(index) ? 'Added ✓' : busyIndex === index ? 'Adding...' : 'Add as a card'}
                    </button>
                  </li>
                ))}
              </ul>
              {addError && <p className="qa-message qa-error" role="alert">{addError}</p>}
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
