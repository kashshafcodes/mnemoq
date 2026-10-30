import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_SUBJECT,
  canonicalCategory,
  canonicalSubject,
  cleanName,
  getCategories,
  getSubjectNames,
  isReservedName,
  subjectAccent,
  subjectHints,
} from '../subjects';
import AiSuggestPanel, { SparkIcon } from './AiSuggestPanel';
import { NO_SUGGEST } from '../noSuggest';
import { holdPosition, isTouchDevice } from '../holdPosition';

const DESTINATION_KEY = 'mnemoq-add-destination';
const HIDE_WRONG_KEY = 'mnemoq-hide-wrong-answer';

// The subject/category you last added to is remembered on this device, so
// the next session can jump straight to typing cards.
function readDestination() {
  try {
    const saved = JSON.parse(localStorage.getItem(DESTINATION_KEY));
    const subject = cleanName(saved?.subject);
    const category = cleanName(saved?.category);

    // Custom subjects and categories are allowed, so any non-empty pair works.
    if (subject && category) return { subject, category };
  } catch {
    // Missing or unreadable: start from the subject step.
  }

  return null;
}

function saveDestination(destination) {
  try {
    localStorage.setItem(DESTINATION_KEY, JSON.stringify(destination));
  } catch {
    // Not critical if it can't be remembered.
  }
}

function readHideWrong() {
  try {
    return localStorage.getItem(HIDE_WRONG_KEY) === '1';
  } catch {
    return false;
  }
}

function saveHideWrong(value) {
  try {
    if (value) {
      localStorage.setItem(HIDE_WRONG_KEY, '1');
    } else {
      localStorage.removeItem(HIDE_WRONG_KEY);
    }
  } catch {
    // Not critical if it can't be remembered.
  }
}

export default function QuickAdd({ cards = [], onSave, onClose, onReviewNow }) {
  const [destination, setDestination] = useState(readDestination);
  const [step, setStep] = useState(destination ? 'entry' : 'subject');
  const [pendingSubject, setPendingSubject] = useState(
    destination?.subject || DEFAULT_SUBJECT
  );

  const [question, setQuestion] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [yourAnswer, setYourAnswer] = useState('');
  const [hook, setHook] = useState('');
  const [showHook, setShowHook] = useState(false);
  const [hideWrong, setHideWrong] = useState(readHideWrong);

  // AI suggestions: null when closed, otherwise the card text they were asked for.
  const [aiInput, setAiInput] = useState(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [addedCount, setAddedCount] = useState(0);
  // Which "Subject › Category" places cards were added to this session, so the
  // summary stays accurate if the destination was changed along the way.
  const [addedTo, setAddedTo] = useState([]);

  // "Add your own" subject or category: which one is being typed, and what.
  const [adding, setAdding] = useState(null); // null | 'subject' | 'category'
  const [ownName, setOwnName] = useState('');
  const [ownError, setOwnError] = useState('');

  const rootRef = useRef(null);
  const ownRef = useRef(null);
  const questionRef = useRef(null);
  const answerRef = useRef(null);
  const wrongRef = useRef(null);
  const hookRef = useRef(null);
  const saveRef = useRef(null);

  const activeStep = step === 'entry' && !destination ? 'subject' : step;

  useEffect(() => {
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  useEffect(() => {
    if (activeStep === 'entry') questionRef.current?.focus();
  }, [activeStep]);

  useEffect(() => {
    if (adding) ownRef.current?.focus();
  }, [adding]);

  // The boxes currently on screen, in typing order.
  function fieldOrder() {
    const order = [questionRef, answerRef];
    if (!hideWrong) order.push(wrongRef);
    if (showHook) order.push(hookRef);
    return order;
  }

  function enterHint(ref) {
    const order = fieldOrder();
    return order[order.length - 1] === ref ? 'done' : 'next';
  }

  // Enter moves to the next box; Enter in the last box saves the card.
  // Shift+Enter keeps its normal "new line" behavior in the bigger boxes.
  function handleKeyDown(event, currentRef) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    if (event.nativeEvent.isComposing) return;

    event.preventDefault();

    const order = fieldOrder();
    const next = order[order.indexOf(currentRef) + 1];

    if (next) {
      next.current?.focus();
    } else {
      handleSave();
    }
  }

  // Returns true when the card was saved, so "Done" can wait for it.
  async function handleSave(event) {
    event?.preventDefault();

    if (saving || !destination) return false;

    if (!question.trim()) {
      setError('Add the question first.');
      questionRef.current?.focus();
      return false;
    }

    if (!correctAnswer.trim()) {
      setError('Add the correct answer.');
      answerRef.current?.focus();
      return false;
    }

    setSaving(true);
    setError('');
    setFlash('');

    const releasePosition = holdPosition(saveRef.current);

    const result = await onSave({
      subject: destination.subject,
      category: destination.category,
      question,
      correctAnswer,
      yourAnswer: hideWrong ? '' : yourAnswer,
      explanation: showHook ? hook : '',
    });

    setSaving(false);

    if (result?.error) {
      setError(`Could not save: ${result.error}`);
      return false;
    }

    setQuestion('');
    setCorrectAnswer('');
    setYourAnswer('');
    setHook('');
    setShowHook(false);
    setAiInput(null);
    setAddedCount((count) => count + 1);
    setAddedTo((labels) => {
      const label = `${destination.subject} › ${destination.category}`;
      return labels.includes(label) ? labels : [...labels, label];
    });
    setFlash('Saved. Add the next one.');

    // On a phone, focusing the question box scrolls the page up and opens the
    // keyboard. Keep the Save button where it was instead; the person taps the
    // question box when ready.
    if (isTouchDevice()) releasePosition();
    else questionRef.current?.focus();

    return true;
  }

  function openAi() {
    if (!question.trim() || !correctAnswer.trim() || !destination) return;

    setAiInput({
      question: question.trim(),
      answer: correctAnswer.trim(),
      hook: showHook ? hook.trim() : '',
      wrong: hideWrong ? '' : yourAnswer.trim(),
      subject: destination.subject,
      category: destination.category,
    });
  }

  function useAiHook(text) {
    setHook(text);
    setShowHook(true);
  }

  // Saves one AI-written question as its own card, in the same place.
  async function addAiCard({ question: aiQuestion, correctAnswer: aiAnswer, distractors }) {
    const result = await onSave({
      subject: destination.subject,
      category: destination.category,
      question: aiQuestion,
      correctAnswer: aiAnswer,
      yourAnswer: '',
      explanation: '',
      distractors,
    });

    if (!result?.error) {
      setAddedCount((count) => count + 1);
      setAddedTo((labels) => {
        const label = `${destination.subject} › ${destination.category}`;
        return labels.includes(label) ? labels : [...labels, label];
      });
    }

    return result;
  }

  function chooseCategory(category) {
    const next = { subject: pendingSubject, category };

    setDestination(next);
    saveDestination(next);
    stopAdding();
    setStep('entry');
  }

  function startAdding(kind) {
    setAdding(kind);
    setOwnName('');
    setOwnError('');
  }

  function stopAdding() {
    setAdding(null);
    setOwnName('');
    setOwnError('');
  }

  // A typed subject or category: reuse an existing one if it matches
  // ignoring capital letters, otherwise it becomes a new one.
  function submitOwn(event, kind) {
    event.preventDefault();

    const name = cleanName(ownName);

    if (!name) {
      setOwnError('Type a name first.');
      return;
    }

    if (isReservedName(name)) {
      setOwnError('Please choose a different name.');
      return;
    }

    if (kind === 'subject') {
      setPendingSubject(canonicalSubject(name, cards));
      stopAdding();
      setStep('category');
    } else {
      chooseCategory(canonicalCategory(pendingSubject, name, cards));
    }
  }

  function renderOwnForm(kind) {
    const isSubject = kind === 'subject';

    return (
      <form className="qa-own" onSubmit={(event) => submitOwn(event, kind)}>
        <label htmlFor="qa-own-name">
          {isSubject ? 'Name your subject' : 'Name your category'}
        </label>
        <div className="qa-own-row">
          <input
            id="qa-own-name"
            ref={ownRef}
            value={ownName}
            maxLength={40}
            onChange={(event) => setOwnName(event.target.value)}
            placeholder={isSubject ? 'e.g. Chemistry' : 'e.g. Organic chemistry'}
            autoComplete="off"
          />
          <button type="submit" className="qa-primary">
            {isSubject ? 'Next' : 'Start adding'}
          </button>
          <button type="button" className="ghost-button" onClick={stopAdding}>
            Cancel
          </button>
        </div>
        {ownError && (
          <p className="qa-message qa-error" role="alert">
            {ownError}
          </p>
        )}
      </form>
    );
  }

  function toggleHideWrong() {
    const next = !hideWrong;

    setHideWrong(next);
    saveHideWrong(next);

    if (next) setYourAnswer('');

    // Put the cursor back in the question box so typing can continue.
    requestAnimationFrame(() => questionRef.current?.focus());
  }

  function toggleHook() {
    const opening = !showHook;

    if (!opening) setHook('');
    setShowHook(opening);

    requestAnimationFrame(() =>
      (opening ? hookRef : questionRef).current?.focus()
    );
  }

  async function finish() {
    const hasText = [question, correctAnswer, yourAnswer, hook].some((value) =>
      value.trim()
    );

    if (hasText) {
      // Don't silently throw away what was typed: a complete card is saved
      // first; an unfinished one asks the person to finish or clear it.
      if (!question.trim() || !correctAnswer.trim()) {
        setError(
          'This card is unfinished. Add the question and correct answer, or clear the boxes, then press Done.'
        );
        return;
      }

      const saved = await handleSave();

      if (!saved) return;

      setError('');
      setFlash('');
      setStep('done');
      return;
    }

    if (addedCount > 0) {
      setError('');
      setFlash('');
      setStep('done');
    } else {
      onClose();
    }
  }

  const destinationLabel = destination
    ? `${destination.subject} › ${destination.category}`
    : '';

  if (activeStep === 'subject') {
    return (
      <section ref={rootRef} className="quick-add">
        <h2>Add cards</h2>
        <p className="subtitle">What are you adding to?</p>

        <div className="qa-chips" role="group" aria-label="Subject">
          {getSubjectNames(cards).map((name) => (
            <button
              key={name}
              type="button"
              className="qa-chip"
              style={{ '--accent': subjectAccent(name) }}
              onClick={() => {
                setPendingSubject(name);
                stopAdding();
                setStep('category');
              }}
            >
              <span className="subject-dot" aria-hidden="true" />
              {name}
            </button>
          ))}
          <button
            type="button"
            className="qa-chip qa-chip-add"
            aria-expanded={adding === 'subject'}
            onClick={() =>
              adding === 'subject' ? stopAdding() : startAdding('subject')
            }
          >
            + Your own
          </button>
        </div>

        {adding === 'subject' && renderOwnForm('subject')}

        <div className="qa-footer">
          {destination && (
            <button
              type="button"
              className="ghost-button"
              onClick={() => setStep('entry')}
            >
              Back
            </button>
          )}
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </section>
    );
  }

  if (activeStep === 'category') {
    return (
      <section
        ref={rootRef}
        className="quick-add"
        style={{ '--accent': subjectAccent(pendingSubject) }}
      >
        <h2>Add cards</h2>
        <p className="subtitle">
          <span className="subject-dot" aria-hidden="true" />
          <strong>{pendingSubject}</strong> › which category?
        </p>

        <div className="qa-chips" role="group" aria-label="Category">
          {getCategories(pendingSubject, cards).map((name) => (
            <button
              key={name}
              type="button"
              className="qa-chip"
              onClick={() => chooseCategory(name)}
            >
              {name}
            </button>
          ))}
          <button
            type="button"
            className="qa-chip qa-chip-add"
            aria-expanded={adding === 'category'}
            onClick={() =>
              adding === 'category' ? stopAdding() : startAdding('category')
            }
          >
            + Your own
          </button>
        </div>

        {adding === 'category' && renderOwnForm('category')}

        <div className="qa-footer">
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              stopAdding();
              setStep('subject');
            }}
          >
            Back
          </button>
          <button type="button" className="ghost-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </section>
    );
  }

  if (activeStep === 'done') {
    return (
      <section ref={rootRef} className="quick-add">
        <h2>Nice work.</h2>
        <p className="subtitle">
          You added <strong>{addedCount}</strong> card
          {addedCount === 1 ? '' : 's'}{' '}
          {addedTo.length === 1 ? (
            <>
              to <strong>{addedTo[0]}</strong>
            </>
          ) : (
            <>across {addedTo.length} topics</>
          )}
          .
        </p>
        {addedTo.length > 1 && (
          <p className="qa-hint">{addedTo.join('  ·  ')}</p>
        )}

        <div className="qa-actions">
          <button type="button" className="qa-primary" onClick={onReviewNow}>
            Review now
          </button>
          <button
            type="button"
            className="ghost-button"
            onClick={() => {
              setAddedCount(0);
              setAddedTo([]);
              setFlash('');
              setStep('entry');
            }}
          >
            Add more
          </button>
          <button type="button" className="ghost-button" onClick={onClose}>
            Close
          </button>
        </div>
      </section>
    );
  }

  const hints = subjectHints(destination?.subject);

  return (
    <section
      ref={rootRef}
      className="quick-add"
      style={{ '--accent': subjectAccent(destination?.subject) }}
    >
      <h2>Add cards</h2>

      <div className="qa-destination">
        <span>
          <span className="subject-dot" aria-hidden="true" />
          Adding to <strong>{destinationLabel}</strong>
        </span>
        <button
          type="button"
          className="text-link"
          onClick={() => {
            setPendingSubject(destination.subject);
            setStep('subject');
          }}
        >
          Change
        </button>
        <span className="qa-count">{addedCount} added</span>
      </div>

      <form className="qa-form" onSubmit={handleSave} noValidate>
        <label htmlFor="qa-question">Question</label>
        <textarea
          id="qa-question"
          ref={questionRef}
          rows={2}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => handleKeyDown(event, questionRef)}
          placeholder={hints.question}
          enterKeyHint={enterHint(questionRef)}
          {...NO_SUGGEST}
        />

        <label htmlFor="qa-answer">Correct answer</label>
        <input
          id="qa-answer"
          ref={answerRef}
          value={correctAnswer}
          onChange={(event) => setCorrectAnswer(event.target.value)}
          onKeyDown={(event) => handleKeyDown(event, answerRef)}
          placeholder={hints.answer}
          enterKeyHint={enterHint(answerRef)}
          {...NO_SUGGEST}
        />

        {!hideWrong && (
          <>
            <label htmlFor="qa-wrong">
              Your answer <span className="optional">(optional)</span>
            </label>
            <input
              id="qa-wrong"
              ref={wrongRef}
              value={yourAnswer}
              onChange={(event) => setYourAnswer(event.target.value)}
              onKeyDown={(event) => handleKeyDown(event, wrongRef)}
              placeholder="If you got it wrong, what did you answer?"
              enterKeyHint={enterHint(wrongRef)}
              {...NO_SUGGEST}
            />
          </>
        )}

        {showHook && (
          <>
            <label htmlFor="qa-hook">
              Memory hook <span className="optional">(optional)</span>
            </label>
            <textarea
              id="qa-hook"
              ref={hookRef}
              rows={2}
              value={hook}
              onChange={(event) => setHook(event.target.value)}
              onKeyDown={(event) => handleKeyDown(event, hookRef)}
              placeholder={hints.hook}
              enterKeyHint={enterHint(hookRef)}
              {...NO_SUGGEST}
            />
          </>
        )}

        <div className="qa-extras">
          <button
            type="button"
            className="text-link"
            onClick={toggleHook}
          >
            {showHook ? '− Remove memory hook' : '+ Add a memory hook'}
          </button>
          <button
            type="button"
            className="text-link"
            onClick={toggleHideWrong}
          >
            {hideWrong ? '+ Show "your answer" box' : 'Hide "your answer" box'}
          </button>
        </div>

        {!aiInput && !yourAnswer.trim() && question.trim() && correctAnswer.trim() && (
          <p className="qa-ai-nudge">
            Tip: add what you answered{' '}
            {hideWrong ? (
              <button type="button" className="text-link" onClick={toggleHideWrong}>
                (show the box)
              </button>
            ) : (
              <button type="button" className="text-link" onClick={() => wrongRef.current?.focus()}>
                (type it above)
              </button>
            )}
            . The AI will then explain why it is not that, which makes a much better memory hook.
          </p>
        )}

        {!aiInput && (
          <button
            type="button"
            className="qa-ai-button"
            disabled={!question.trim() || !correctAnswer.trim()}
            onClick={openAi}
          >
            <SparkIcon /> Suggest with AI
            <span>memory hook, concept and similar questions</span>
          </button>
        )}

        {aiInput && (
          <AiSuggestPanel
            input={aiInput}
            hookIsEmpty={!hook.trim()}
            onUseHook={useAiHook}
            onAddCard={addAiCard}
            onClose={() => setAiInput(null)}
          />
        )}

        {error && (
          <p className="qa-message qa-error" role="alert">
            {error}
          </p>
        )}
        {!error && flash && (
          <p className="qa-message" role="status">
            {flash}
          </p>
        )}

        <div className="qa-actions">
          <button ref={saveRef} type="submit" className="qa-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save & add next'}
          </button>
          <button type="button" className="ghost-button" onClick={finish}>
            Done
          </button>
        </div>

        <p className="qa-hint">
          Press Enter to move to the next box. Enter in the last box saves the
          card. Shift+Enter starts a new line.
        </p>
      </form>
    </section>
  );
}
