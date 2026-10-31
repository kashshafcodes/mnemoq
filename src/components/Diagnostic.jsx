import { useMemo, useRef, useState } from 'react';
import { CoachError, requestAnalysis, requestDiagnostic, requestEssayGrade } from '../coachApi';
import { ESSAY_PROMPTS, MIN_ESSAY_WORDS, countWords, scoreSections } from '../diagnosticScore';
import { analysisPayload } from '../readiness';
import { NO_SUGGEST } from '../noSuggest';
import AiBadge from './AiBadge';

// The first-day diagnostic: the AI writes the questions, the student answers
// them, the AI marks the essay and then reads the results.
//
//   intro -> loading -> quiz (one section at a time) -> essay -> finishing -> onFinish

const LETTERS = ['A', 'B', 'C', 'D'];

function pickEssayPrompt() {
  return ESSAY_PROMPTS[Math.floor(Math.random() * ESSAY_PROMPTS.length)];
}

export default function Diagnostic({ pathId, pathName, hasEssay, daysLeft, target, examDate, kind, onFinish, onCancel }) {
  const [phase, setPhase] = useState('intro'); // intro | loading | error | quiz | essay | finishing
  const [sections, setSections] = useState([]);
  const [missing, setMissing] = useState([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [essayPrompt] = useState(pickEssayPrompt);
  const [essayText, setEssayText] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState('');
  const topRef = useRef(null);

  const section = sections[index];
  const words = countWords(essayText);
  const answeredHere = section ? section.questions.filter((q) => Number.isInteger(answers[q.id])).length : 0;

  function scrollTop() {
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  async function start() {
    setPhase('loading');
    setError('');

    try {
      const data = await requestDiagnostic(pathId);

      setSections(data.sections);
      setMissing(data.missing || []);
      setIndex(0);
      setAnswers({});
      setPhase('quiz');
      scrollTop();
    } catch (caught) {
      setError(caught instanceof CoachError ? caught.message : 'Something went wrong. Try again.');
      setPhase('error');
    }
  }

  function nextSection() {
    if (index + 1 < sections.length) {
      setIndex(index + 1);
    } else if (hasEssay) {
      setPhase('essay');
    } else {
      finish(false);
    }

    scrollTop();
  }

  async function finish(withEssay) {
    setPhase('finishing');
    setError('');

    const scored = scoreSections(sections, answers);
    let essay = null;
    let note = '';

    if (withEssay && words >= MIN_ESSAY_WORDS) {
      setStep('The AI is marking your essay...');

      try {
        const graded = await requestEssayGrade(essayPrompt, essayText);

        essay = graded.essay;
      } catch (caught) {
        note = `Your essay could not be marked (${caught?.message || 'unknown error'}). You can retake the diagnostic later.`;
      }
    }

    const result = { kind, sections: scored, essay, analysis: null };

    setStep('The AI is reading your results...');

    try {
      const data = await requestAnalysis(analysisPayload(pathId, result, examDate, target));

      result.analysis = data.analysis;
    } catch (caught) {
      note = note || `The AI analysis could not run (${caught?.message || 'unknown error'}). You can run it again from your path page.`;
    }

    onFinish(result, note);
  }

  const missingNames = useMemo(() => missing.join(', '), [missing]);

  return (
    <section className="diag" ref={topRef}>
      <header className="diag-head">
        <div>
          <p className="eyebrow">{kind === 'retest' ? 'RETAKE' : 'FIRST-DAY DIAGNOSTIC'}</p>
          <h2>
            {pathName} <AiBadge>AI diagnostic</AiBadge>
          </h2>
        </div>
        {phase !== 'finishing' && (
          <button type="button" className="text-link" onClick={onCancel}>
            Cancel
          </button>
        )}
      </header>

      {phase === 'intro' && (
        <div className="diag-card">
          <h3>Find out exactly where you stand</h3>
          <ul className="diag-list">
            <li>The AI writes fresh questions for each part of the exam, and a second AI pass re-solves every answer key before you see it.</li>
            <li>
              About 20 minutes: a few questions in each section{hasEssay ? ', then a short essay' : ''}. Do it without looking anything up.
            </li>
            <li>
              It is not a grade. It finds your weak topics so your readiness score, review plan and daily work can focus on them.
            </li>
            {daysLeft !== null && <li>You have {daysLeft} {daysLeft === 1 ? 'day' : 'days'} until the exam, so every week counts.</li>}
          </ul>
          <button type="button" className="qa-primary" onClick={start}>
            Start the diagnostic
          </button>
        </div>
      )}

      {phase === 'loading' && (
        <div className="diag-card diag-wait" role="status">
          <span className="ai-dots" aria-hidden="true">
            <i /><i /><i />
          </span>
          <h3>The AI is writing your diagnostic</h3>
          <p>It writes the questions, then checks every answer key. This can take up to a minute.</p>
        </div>
      )}

      {phase === 'error' && (
        <div className="diag-card" role="alert">
          <h3>That did not work</h3>
          <p className="diag-error">{error}</p>
          <div className="diag-actions">
            <button type="button" className="qa-primary" onClick={start}>
              Try again
            </button>
            <button type="button" className="ghost-button" onClick={onCancel}>
              Back
            </button>
          </div>
        </div>
      )}

      {phase === 'quiz' && section && (
        <div className="diag-card">
          <p className="diag-step">
            Section {index + 1} of {sections.length + (hasEssay ? 1 : 0)} · {section.name}
          </p>
          <div className="diag-bar" aria-hidden="true">
            <span style={{ width: `${(index / (sections.length + (hasEssay ? 1 : 0))) * 100}%` }} />
          </div>

          {missing.length > 0 && index === 0 && (
            <p className="diag-note">
              The AI could not write {missingNames} this time, so it is left out. You can retake the diagnostic later to add it.
            </p>
          )}

          {section.passage && (
            <blockquote className="diag-passage">
              <p>{section.passage}</p>
            </blockquote>
          )}

          <ol className="diag-questions">
            {section.questions.map((q, qi) => (
              <li key={q.id}>
                <p className="diag-q">
                  <span>{qi + 1}.</span> {q.question}
                </p>
                <div className="diag-options" role="radiogroup" aria-label={`Question ${qi + 1}`}>
                  {q.options.map((option, oi) => (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={answers[q.id] === oi}
                      className={answers[q.id] === oi ? 'diag-option selected' : 'diag-option'}
                      onClick={() => setAnswers((current) => ({ ...current, [q.id]: oi }))}
                    >
                      <b aria-hidden="true">{LETTERS[oi]}</b>
                      <span>{option}</span>
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ol>

          <div className="diag-actions">
            <button type="button" className="qa-primary" onClick={nextSection}>
              {index + 1 < sections.length ? 'Next section' : hasEssay ? 'Go to the essay' : 'Finish'}
            </button>
            <span className="diag-count">
              {answeredHere} of {section.questions.length} answered
              {answeredHere < section.questions.length && ' · unanswered questions count as missed'}
            </span>
          </div>
        </div>
      )}

      {phase === 'essay' && (
        <div className="diag-card">
          <p className="diag-step">Final part · Essay</p>
          <div className="diag-bar" aria-hidden="true">
            <span style={{ width: '90%' }} />
          </div>
          <h3>{essayPrompt}</h3>
          <p className="diag-note">Write about 150 to 250 words. The AI marks content, organisation, language and grammar.</p>
          <label htmlFor="diag-essay" className="sr-only">
            Your essay
          </label>
          <textarea
            id="diag-essay"
            className="diag-essay"
            rows={12}
            value={essayText}
            onChange={(event) => setEssayText(event.target.value)}
            placeholder="Start writing here..."
            {...NO_SUGGEST}
          />
          <p className={words >= MIN_ESSAY_WORDS ? 'diag-count ok' : 'diag-count'}>
            {words} {words === 1 ? 'word' : 'words'}
            {words < MIN_ESSAY_WORDS && ` · at least ${MIN_ESSAY_WORDS} to be marked`}
          </p>
          <div className="diag-actions">
            <button type="button" className="qa-primary" disabled={words < MIN_ESSAY_WORDS} onClick={() => finish(true)}>
              Finish and see my results
            </button>
            <button type="button" className="ghost-button" onClick={() => finish(false)}>
              Skip the essay
            </button>
          </div>
        </div>
      )}

      {phase === 'finishing' && (
        <div className="diag-card diag-wait" role="status">
          <span className="ai-dots" aria-hidden="true">
            <i /><i /><i />
          </span>
          <h3>{step || 'Working out your results...'}</h3>
          <p>Almost done. Please keep this page open.</p>
        </div>
      )}
    </section>
  );
}
