import { useState } from 'react';
import { PATH_LIST, scaleOf } from '../paths';
import AiBadge from './AiBadge';
import { entryExam } from '../entryExam';

const todayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Choosing a path: which exam, when, and what score the student is aiming for.
//   exclude:  path ids the student already follows (when adding another exam)
//   replaces: name of the exam that will be replaced, when the account can
//             only hold one path (supabase/stage4.sql has not been run)
export default function PathSetup({ onSave, saving, error, exclude = [], onCancel = null, replaces = '' }) {
  const choices = PATH_LIST.filter((p) => !exclude.includes(p.id));
  // Pre-select the exam their entry link was about (/sat, ?exam=nsu ...), if any.
  const [pathId, setPathId] = useState(() => (choices.find((p) => p.id === entryExam()) || choices[0])?.id || '');
  const [examDate, setExamDate] = useState('');
  const chosen = choices.find((p) => p.id === pathId);
  const [target, setTarget] = useState(chosen?.target ?? 75);
  const scale = scaleOf(chosen);

  function choose(path) {
    setPathId(path.id);
    setTarget(path.target);
  }

  function submit(event) {
    event.preventDefault();

    if (!saving && chosen) onSave({ pathId, examDate: examDate || null, target });
  }

  return (
    <section className="path-setup">
      <header>
        <p className="eyebrow">{onCancel ? 'ADD AN EXAM' : 'YOUR EXAM PATH'}</p>
        <h2>
          What are you preparing for? <AiBadge>AI-built plan</AiBadge>
        </h2>
        <p className="subtitle">
          Pick your exam and Mnemoq builds your preparation around it: a countdown, a diagnostic of every section, and a
          score that moves as you practise.
        </p>
      </header>

      {choices.length === 0 ? (
        <p className="subtitle">You already follow every exam Mnemoq offers. More are on the way.</p>
      ) : (
        <form onSubmit={submit} className="path-form">
          <div className="path-choices" role="radiogroup" aria-label="Exam path">
            {choices.map((path) => (
              <button
                key={path.id}
                type="button"
                role="radio"
                aria-checked={pathId === path.id}
                className={pathId === path.id ? 'path-choice selected' : 'path-choice'}
                onClick={() => choose(path)}
              >
                <strong>{path.name}</strong>
                <span>{path.tagline}</span>
              </button>
            ))}
            <div className="path-choice path-soon" aria-disabled="true">
              <strong>More exams soon</strong>
              <span>BUET, medical and more are on the way.</span>
            </div>
          </div>

          <label htmlFor="path-date">
            {chosen?.engine === 'sat' ? 'Test date' : 'Exam date'} <span className="optional">(optional, you can add it later)</span>
          </label>
          <input id="path-date" type="date" min={todayString()} value={examDate} onChange={(e) => setExamDate(e.target.value)} />

          <label htmlFor="path-target">
            Target {scale.word}: <b>{target}</b> out of {scale.max}
          </label>
          <input
            id="path-target"
            type="range"
            className="fancy-range"
            style={{ '--fill': `${((target - scale.targetMin) / (scale.targetMax - scale.targetMin)) * 100}%` }}
            min={scale.targetMin}
            max={scale.targetMax}
            step={scale.step}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
          />
          <p className="path-hint">
            {chosen?.engine === 'sat'
              ? 'Your target is the total SAT score you want, from 400 to 1600. Many scholarship programmes look for 1400 or more. You can change it at any time.'
              : `Readiness is your estimated chance-ready score. Most students aim for about ${chosen?.target ?? 75}.`}
          </p>

          {replaces && (
            <p className="path-notice" role="status">
              Your account can hold one exam at the moment, so this will replace {replaces}. Your {replaces} results stay saved.
              To keep both side by side, the site owner needs to run <code>supabase/stage4.sql</code>.
            </p>
          )}

          {error && (
            <p className="qa-message qa-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="qa-primary" disabled={saving || !chosen}>
            {saving ? 'Saving...' : onCancel ? 'Add this exam' : 'Start my path'}
          </button>
        </form>
      )}

      {onCancel && (
        <button type="button" className="text-link" onClick={onCancel}>
          Cancel
        </button>
      )}
    </section>
  );
}
