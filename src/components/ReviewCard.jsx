import { useEffect, useRef, useState } from 'react';
import { buildChoices, checkTypedAnswer, normalizeText, scheduleNext } from '../quiz';
import { formatDays } from '../analytics';
import { subjectAccent } from '../subjects';
import { RatingGuide } from './Tutorial';

const MODE_KEY = 'mnemoq-review-mode';
const LETTERS = ['A', 'B', 'C', 'D'];

// The answer style is remembered per subject, so someone can choose from
// options for General Knowledge but type their English answers.
function modeKey(subject) {
  return `${MODE_KEY}:${String(subject || '').toLocaleLowerCase()}`;
}

function readMode(subject) {
  try {
    const own = localStorage.getItem(modeKey(subject));

    if (own === 'type' || own === 'choose') return own;

    // Nothing saved for this subject yet: start from the old all-subjects
    // choice, so nobody loses the style they already picked.
    return localStorage.getItem(MODE_KEY) === 'type' ? 'type' : 'choose';
  } catch {
    return 'choose';
  }
}

function saveMode(subject, mode) {
  try {
    localStorage.setItem(modeKey(subject), mode);
  } catch {
    // Not critical if it can't be remembered.
  }
}

// Which rating to highlight after the answer. It's only a suggestion: the
// person always picks the rating themselves.
const SUGGESTED = {
  correct: 'good',
  close: 'hard',
  wrong: 'again',
  skipped: 'again',
};

const RATINGS = [
  { id: 'again', label: 'Again', key: '1' },
  { id: 'hard', label: 'Hard', key: '2' },
  { id: 'good', label: 'Good', key: '3' },
  { id: 'easy', label: 'Easy', key: '4' },
];

// "10 minutes", "1 day", "3 weeks": when the card comes back after a rating.
function comesBack(rating, intervalDays) {
  const next = scheduleNext(rating, intervalDays);

  return next.intervalDays === 0 ? '10 minutes' : formatDays(next.intervalDays);
}

// Keys that should never count as "any key".
const IGNORED_KEYS = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Escape', 'OS', 'ContextMenu']);

// Ignore keys for a moment after the answer appears, so the Enter that checked
// an answer can't also continue to the next card.
const KEY_GRACE_MS = 450;

// One card being reviewed. App gives it a new `key` for every card, so all of
// its state starts fresh each time.
export default function ReviewCard({ card, cards, position, onRate }) {
  const [preferredMode, setPreferredMode] = useState(() => readMode(card.subject));
  const [choices] = useState(() => buildChoices(card, cards));
  const [typed, setTyped] = useState('');
  const [pickedIndex, setPickedIndex] = useState(null);
  const [result, setResult] = useState(null); // null while still asking
  const [hint, setHint] = useState('');
  const [saving, setSaving] = useState(false);
  const [manual, setManual] = useState(false);
  const answeredAt = useRef(0);
  const savingRef = useRef(false);

  const inputRef = useRef(null);
  const resultRef = useRef(null);

  const mode = preferredMode === 'choose' && choices.available ? 'choose' : 'type';
  const answered = result !== null;
  const choiceFallback = preferredMode === 'choose' && !choices.available;

  useEffect(() => {
    if (!answered && mode === 'type') inputRef.current?.focus();
  }, [mode, answered]);

  useEffect(() => {
    if (answered) {
      answeredAt.current = Date.now();
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [answered]);

  function chooseMode(next) {
    setPreferredMode(next);
    saveMode(card.subject, next);
    setHint('');
  }

  function pickOption(index) {
    if (answered) return;

    setPickedIndex(index);
    setResult(choices.options[index].isCorrect ? 'correct' : 'wrong');
  }

  // Letter keys A-D pick an option, as long as nobody is typing in a box.
  // (After answering, the number keys 1-4 are for rating.)
  useEffect(() => {
    if (mode !== 'choose' || answered) return undefined;

    function handleKey(event) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const tag = event.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // A, B, C, D (any case) pick the option with that letter.
      const index = event.key.length === 1 ? LETTERS.indexOf(event.key.toUpperCase()) : -1;

      if (index >= 0 && index < choices.options.length) {
        event.preventDefault();
        pickOption(index);
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // pickOption only reads state that is already covered by these inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, answered, choices]);

  function checkTyped(event) {
    event?.preventDefault();

    if (answered) return;

    const verdict = checkTypedAnswer(typed, card.correctAnswer, card.yourAnswer);

    if (verdict === 'empty') {
      setHint('Type your answer first, or press "Show answer".');
      inputRef.current?.focus();
      return;
    }

    setHint('');
    setResult(verdict);
  }

  function showAnswer() {
    if (!answered) setResult('skipped');
  }

  async function rate(rating) {
    if (savingRef.current) return;

    savingRef.current = true;
    setSaving(true);
    await onRate(rating, result);
    savingRef.current = false;
    setSaving(false);
  }

  // After answering: any key accepts the suggested rating and moves on, and
  // 1-4 pick a rating directly. Once "choose myself" is open, only 1-4 work.
  useEffect(() => {
    if (!answered) return undefined;

    function handleKey(event) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      if (event.isComposing || IGNORED_KEYS.has(event.key) || /^F\d+$/.test(event.key)) return;
      if (Date.now() - answeredAt.current < KEY_GRACE_MS) return;

      const direct = RATINGS.find((rating) => rating.key === event.key);

      // On a focused button, link or the "How do these work?" toggle, keys keep
      // their normal job. Only 1-4 still pick a rating from there.
      const tag = event.target?.tagName;
      const onControl = ['BUTTON', 'A', 'SUMMARY', 'INPUT', 'TEXTAREA', 'SELECT'].includes(tag);

      if (onControl && !(direct && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT')) return;

      if (direct) {
        event.preventDefault();
        rate(direct.id);
        return;
      }

      if (manual) return;

      event.preventDefault();
      rate(SUGGESTED[result]);
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // rate only reads refs and the props covered here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, manual, result, onRate]);

  const repeatedOldMistake =
    result === 'wrong' &&
    card.yourAnswer &&
    normalizeText(mode === 'choose' ? choices.options[pickedIndex]?.text : typed) ===
      normalizeText(card.yourAnswer);

  let banner = null;

  if (result === 'correct') {
    banner = {
      tone: 'correct',
      title: 'Correct!',
      body: card.yourAnswer
        ? `You first answered "${card.yourAnswer}". Now you've got it.`
        : 'Nice recall.',
    };
  } else if (result === 'close') {
    banner = {
      tone: 'close',
      title: 'Almost!',
      body: `Check the spelling. It's "${card.correctAnswer}".`,
    };
  } else if (result === 'wrong') {
    banner = {
      tone: 'wrong',
      title: 'Not quite.',
      body: repeatedOldMistake
        ? 'That is the same answer you gave before. Here is the fix.'
        : mode === 'choose'
          ? 'The correct answer is highlighted in green.'
          : 'The correct answer is below.',
    };
  } else if (result === 'skipped') {
    banner = {
      tone: 'skipped',
      title: 'No problem.',
      body: 'Here is the answer. You will see it again soon.',
    };
  }

  const suggested = SUGGESTED[result];
  const suggestedRating = RATINGS.find((rating) => rating.id === suggested) || RATINGS[2];

  return (
    <div
      className="review-card accented"
      style={{ '--accent': subjectAccent(card.subject) }}
    >
      <div className="review-card-top">
        <span className="category-badge">
          <span className="subject-dot" aria-hidden="true" />
          {card.subject} · {card.category}
        </span>
        <span className="review-counter">
          Card {position.index + 1} of {position.total}
        </span>
      </div>

      {!answered && (
        <div className="review-mode" role="group" aria-label="Answer style">
          <button
            type="button"
            className={mode === 'choose' ? 'mode-button selected' : 'mode-button'}
            aria-pressed={mode === 'choose'}
            onClick={() => chooseMode('choose')}
          >
            Choose
          </button>
          <button
            type="button"
            className={mode === 'type' ? 'mode-button selected' : 'mode-button'}
            aria-pressed={mode === 'type'}
            onClick={() => chooseMode('type')}
          >
            Type
          </button>
        </div>
      )}

      <h3 className="review-question" id="review-question-text">
        {card.question}
      </h3>

      {choiceFallback && !answered && (
        <p className="review-note">
          Multiple choice needs a few more cards in your library to make
          choices from, so this one is typed.
        </p>
      )}

      {mode === 'choose' && (
        <div
          className="mcq-options"
          role="group"
          aria-labelledby="review-question-text"
        >
          {choices.options.map((option, index) => {
            let state = '';

            if (answered) {
              if (option.isCorrect) state = ' correct';
              else if (index === pickedIndex) state = ' wrong';
              else state = ' dimmed';
            }

            return (
              <button
                key={option.text}
                type="button"
                className={`mcq-option${state}`}
                disabled={answered}
                onClick={() => pickOption(index)}
              >
                <span className="mcq-letter" aria-hidden="true">
                  {LETTERS[index]}
                </span>
                <span className="mcq-text">{option.text}</span>
              </button>
            );
          })}
        </div>
      )}

      {mode === 'choose' && !answered && (
        <p className="choose-hint">
          Press <kbd>A</kbd> to <kbd>{LETTERS[choices.options.length - 1]}</kbd> to answer
        </p>
      )}

      {mode === 'type' && !answered && (
        <form className="type-answer" onSubmit={checkTyped}>
          <label htmlFor="review-typed" className="sr-only">
            Your answer
          </label>
          <input
            id="review-typed"
            ref={inputRef}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="Type your answer"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck="false"
            enterKeyHint="done"
          />
          <button type="submit" className="primary-button">
            Check
          </button>
        </form>
      )}

      {mode === 'type' && answered && result !== 'skipped' && (
        <p className="typed-echo">
          You typed: <strong>{typed}</strong>
        </p>
      )}

      {hint && (
        <p className="review-note" role="status">
          {hint}
        </p>
      )}

      {!answered && (
        <button type="button" className="text-link show-answer" onClick={showAnswer}>
          I don&apos;t know. Show answer
        </button>
      )}

      {banner && (
        <div
          ref={resultRef}
          className={`review-result ${banner.tone}`}
          role="status"
        >
          <strong>{banner.title}</strong>
          <span>{banner.body}</span>
          {mode === 'type' && result === 'wrong' && (
            <button
              type="button"
              className="text-link"
              onClick={() => setResult('correct')}
            >
              I was actually right
            </button>
          )}
        </div>
      )}

      {answered && (
        <div className="review-answer">
          {mode === 'type' && (
            <>
              {card.yourAnswer && (
                <div className="answer-block">
                  <p className="eyebrow">YOUR ORIGINAL ANSWER</p>
                  <p>{card.yourAnswer}</p>
                </div>
              )}

              <div className="answer-block correct-answer-block">
                <p className="eyebrow">CORRECT ANSWER</p>
                <p>{card.correctAnswer}</p>
              </div>

              <details className="rating-help">
            <summary>How do these work?</summary>
            <RatingGuide />
          </details>
            </>
          )}

          {card.explanation && (
            <div className="answer-block">
              <p className="eyebrow">MEMORY HOOK</p>
              <p>{card.explanation}</p>
            </div>
          )}

          <div className="quick-next">
            <button
              type="button"
              className="primary-button continue-button"
              disabled={saving}
              onClick={() => rate(suggestedRating.id)}
            >
              <strong>Continue</strong>
              <span>
                {suggestedRating.label} · back in {comesBack(suggestedRating.id, card.reviewIntervalDays)}
              </span>
            </button>

            <p className="press-any-key">
              Press <kbd>any key</kbd> to continue
            </p>
          </div>

          <button
            type="button"
            className="text-link manual-toggle"
            aria-expanded={manual}
            onClick={() => setManual((open) => !open)}
          >
            {manual ? 'Hide ratings' : 'Rate it yourself'}
          </button>

          {manual && (
            <>
              <p className="rating-prompt">How did that feel?</p>

              <div className="review-rating-buttons">
                {RATINGS.map((rating) => (
                  <button
                    key={rating.id}
                    type="button"
                    className={`rating-button rating-${rating.id}${
                      suggested === rating.id ? ' suggested' : ''
                    }`}
                    disabled={saving}
                    onClick={() => rate(rating.id)}
                  >
                    {rating.label}
                    <span>{comesBack(rating.id, card.reviewIntervalDays)}</span>
                    <kbd aria-hidden="true">{rating.key}</kbd>
                    {suggested === rating.id && (
                      <em className="suggest-tag">Suggested</em>
                    )}
                  </button>
                ))}
              </div>

              <details className="rating-help">
                <summary>How do these work?</summary>
                <RatingGuide />
              </details>
            </>
          )}
        </div>
      )}
    </div>
  );
}
