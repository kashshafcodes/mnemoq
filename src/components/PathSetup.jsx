import { useState } from 'react';
import { PATH_LIST } from '../paths';
import AiBadge from './AiBadge';

const todayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Choosing a path: which exam, when, and what score the student is aiming for.
export default function PathSetup({ onSave, saving, error }) {
  const [pathId, setPathId] = useState(PATH_LIST[0]?.id || '');
  const [examDate, setExamDate] = useState('');
  const chosen = PATH_LIST.find((p) => p.id === pathId);
  const [target, setTarget] = useState(chosen?.target ?? 75);

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
        <p className="eyebrow">YOUR EXAM PATH</p>
        <h2>
          What are you preparing for? <AiBadge>AI-built plan</AiBadge>
        </h2>
        <p className="subtitle">
          Pick your exam and Mnemoq builds your preparation around it: a countdown, an AI diagnostic of every section,
          and a readiness score that moves as you practise.
        </p>
      </header>

      <form onSubmit={submit} className="path-form">
        <div className="path-choices" role="radiogroup" aria-label="Exam path">
          {PATH_LIST.map((path) => (
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
          Exam date <span className="optional">(optional, you can add it later)</span>
        </label>
        <input id="path-date" type="date" min={todayString()} value={examDate} onChange={(e) => setExamDate(e.target.value)} />

        <label htmlFor="path-target">
          Target readiness: <b>{target}</b> out of 100
        </label>
        <input
          id="path-target"
          type="range"
          min="40"
          max="95"
          step="5"
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
        />
        <p className="path-hint">Readiness is your estimated chance-ready score. Most students aim for about {chosen?.target ?? 75}.</p>

        {error && (
          <p className="qa-message qa-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="qa-primary" disabled={saving || !chosen}>
          {saving ? 'Saving...' : 'Start my path'}
        </button>
      </form>
    </section>
  );
}
