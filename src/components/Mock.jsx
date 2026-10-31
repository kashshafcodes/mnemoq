import { useState } from 'react';
import { CoachError, requestMock } from '../coachApi';
import { MOCK_SECTIONS, SOURCES, assemblePaper, maxFor, sectionName, sectionsNeedingAi, suggestMinutes } from '../mocks';
import AiBadge from './AiBadge';
import MockSession from './MockSession';
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
  const [phase, setPhase] = useState('build'); // build | loading | error | run
  const [source, setSource] = useState('ai');
  const [picked, setPicked] = useState(() => Object.fromEntries(sectionIds.map((id) => [id, true])));
  const [counts, setCounts] = useState({});
  const [timerOn, setTimerOn] = useState(true);
  const [minutes, setMinutes] = useState(null); // null = use the suggestion
  const [error, setError] = useState('');
  const [paper, setPaper] = useState([]);
  const [run, setRun] = useState(0);

  const countFor = (id) => Math.min(counts[id] ?? maxFor(id, source, bank), maxFor(id, source, bank));
  const choices = sectionIds.filter((id) => picked[id] && maxFor(id, source, bank) > 0).map((id) => ({ id, count: countFor(id) }));
  const totalQuestions = choices.reduce((sum, c) => sum + c.count, 0);
  const suggested = suggestMinutes(totalQuestions);
  const chosenMinutes = minutes ?? suggested;

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
    setRun((n) => n + 1);
    setPhase('run');
  }

  const head = (
    <header className="diag-head">
      <div>
        <p className="eyebrow">MOCK TEST</p>
        <h2>
          {path.name} <AiBadge>AI mock test</AiBadge>
        </h2>
      </div>
      {phase !== 'loading' && (
        <button type="button" className="text-link" onClick={onClose}>
          Cancel
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
                        className="fancy-range"
                        style={{ '--fill': `${max > Math.min(3, max) ? ((countFor(id) - Math.min(3, max)) / (max - Math.min(3, max))) * 100 : 100}%` }}
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

  return (
    <MockSession
      key={run}
      title="Custom mock test"
      paper={paper}
      limitSeconds={timerOn ? chosenMinutes * 60 : null}
      source={source}
      pathId={pathId}
      diagnostic={diagnostic}
      reviews={reviews}
      mocks={mocks}
      onSaveMock={onSaveMock}
      onAddCards={onAddCards}
      onQuit={() => setPhase('build')}
    >
      <div className="diag-actions">
        <button type="button" className="qa-primary" onClick={() => setPhase('build')}>
          Build another test
        </button>
        <button type="button" className="ghost-button" onClick={onClose}>
          Back to mock tests
        </button>
      </div>
    </MockSession>
  );
}
