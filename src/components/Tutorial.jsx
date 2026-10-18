import { useEffect, useRef, useState } from 'react';

// Explains what each review rating does. Used in the tutorial and also shown
// inline under the rating buttons so help is available right where it's needed.
export function RatingGuide() {
  return (
    <div className="tutorial-intervals" role="table" aria-label="Rating guide">
      <div role="row">
        <span role="cell" className="rate rate-again">Again</span>
        <span role="cell">Back in 10 minutes. You didn't remember it.</span>
      </div>
      <div role="row">
        <span role="cell" className="rate rate-hard">Hard</span>
        <span role="cell">Back after the same gap as last time (1 day for a new card).</span>
      </div>
      <div role="row">
        <span role="cell" className="rate rate-good">Good</span>
        <span role="cell">The gap doubles: 1 day, then 2, 4, 8&hellip;</span>
      </div>
      <div role="row">
        <span role="cell" className="rate rate-easy">Easy</span>
        <span role="cell">The gap triples (at least 3 days).</span>
      </div>
    </div>
  );
}

const STEPS = [
  {
    eyebrow: 'STEP 1 OF 4',
    title: 'Add what you want to remember',
    body: (
      <>
        <p>
          A card needs just two things: a <strong>question</strong> and its{' '}
          <strong>correct answer</strong>. Everything else is optional.
        </p>
        <ul>
          <li>
            Missed something? Add <strong>your incorrect answer</strong> to see
            exactly what tripped you up.
          </li>
          <li>
            Add a <strong>memory hook</strong>: a mnemonic, a picture in your
            head, or a short reason that makes it stick.
          </li>
          <li>
            Pick a <strong>subject</strong> and category so you can filter your
            library later.
          </li>
        </ul>
      </>
    ),
  },
  {
    eyebrow: 'STEP 2 OF 4',
    title: 'Review with active recall',
    body: (
      <>
        <p>
          In <strong>Review your cards</strong>, you see only the question.
          Answer it before you see the solution: <strong>Choose</strong> from
          options made from your own cards (including the wrong answer you
          gave before), or <strong>Type</strong> it yourself.
        </p>
        <p>
          Not sure? Press <strong>Show answer</strong>. Trying to recall
          first is what builds memory. Re-reading the answer does much less.
        </p>
      </>
    ),
  },
  {
    eyebrow: 'STEP 3 OF 4',
    title: 'Tell us how it felt',
    body: (
      <>
        <p>
          Your rating decides when the card comes back, so the cards you find
          hard return sooner and the easy ones fade into the background.
        </p>
        <RatingGuide />
      </>
    ),
  },
  {
    eyebrow: 'STEP 4 OF 4',
    title: 'A little every day',
    body: (
      <>
        <p>
          Short, regular sessions beat long cramming. When a card is due, it
          appears in your review queue. When nothing is due, you're all caught
          up.
        </p>
        <p>
          A card counts as <strong>mastered</strong> once you've reviewed it at
          least 3 times and rated it Good or Easy.
        </p>
        <p className="tutorial-note">
          You can reopen this guide any time from <strong>How it works</strong>{' '}
          in the sidebar.
        </p>
      </>
    ),
  },
];

export default function Tutorial({ onClose }) {
  const [stepIndex, setStepIndex] = useState(0);
  const primaryRef = useRef(null);

  const step = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  useEffect(() => {
    primaryRef.current?.focus();
  }, [stepIndex]);

  useEffect(() => {
    function handleKey(event) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="tutorial-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="tutorial-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
      >
        <p className="eyebrow">{step.eyebrow}</p>
        <h2 id="tutorial-title">{step.title}</h2>

        <div className="tutorial-body">{step.body}</div>

        <div className="tutorial-dots" aria-hidden="true">
          {STEPS.map((_, index) => (
            <span
              key={index}
              className={index === stepIndex ? 'dot active' : 'dot'}
            />
          ))}
        </div>

        <div className="tutorial-actions">
          <button type="button" className="ghost-button" onClick={onClose}>
            {isLast ? 'Close' : 'Skip'}
          </button>

          <div className="tutorial-nav">
            {!isFirst && (
              <button
                type="button"
                className="ghost-button"
                onClick={() => setStepIndex(stepIndex - 1)}
              >
                Back
              </button>
            )}
            <button
              type="button"
              className="primary-button"
              ref={primaryRef}
              onClick={() =>
                isLast ? onClose() : setStepIndex(stepIndex + 1)
              }
            >
              {isLast ? 'Got it' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
