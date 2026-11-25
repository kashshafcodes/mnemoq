import { useState } from 'react';
import { PATH_LIST, scaleOf } from '../paths';
import AiBadge from './AiBadge';
import { entryExam } from '../entryExam';
import { useExamT } from '../exam/strings';

const todayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Choosing a path: which exam, when, and what score the student is aiming for.
//   exclude:  path ids the student already follows (when adding another exam)
//   replaces: name of the exam that will be replaced, when the account can
//             only hold one path (supabase/stage4.sql has not been run)
export default function PathSetup({ onSave, saving, error, exclude = [], onCancel = null, replaces = '' }) {
  const t = useExamT();
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
        <p className="eyebrow">{onCancel ? t('ex.kicker.add') : t('ex.kicker')}</p>
        <h2>
          {t('ex.title')} <AiBadge>{t('ex.ai')}</AiBadge>
        </h2>
        <p className="subtitle">{t('ex.sub')}</p>
      </header>

      {choices.length === 0 ? (
        <p className="subtitle">{t('ex.all')}</p>
      ) : (
        <form onSubmit={submit} className="path-form">
          <div className="path-choices" role="radiogroup" aria-label={t('ex.choices')}>
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
              <strong>{t('ex.soon')}</strong>
              <span>{t('ex.soon.sub')}</span>
            </div>
          </div>

          <label htmlFor="path-date">
            {chosen?.engine === 'sat' ? t('ex.date.sat') : t('ex.date')} <span className="optional">{t('ex.optional')}</span>
          </label>
          <input id="path-date" type="date" min={todayString()} value={examDate} onChange={(e) => setExamDate(e.target.value)} />

          <label htmlFor="path-target">
            {t('ex.target', { word: scale.word === 'readiness' ? t('ex.word.readiness') : t('ex.word.score') })}
            <b>{t('ex.n', { n: target })}</b>
            {t('ex.outOf', { max: scale.max })}
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
            {chosen?.engine === 'sat' ? t('ex.hint.sat') : t('ex.hint', { n: chosen?.target ?? 75 })}
          </p>

          {replaces && (
            <p className="path-notice" role="status">
              {t('ex.replaces', { name: replaces })} To keep both side by side, the site owner needs to run <code>supabase/stage4.sql</code>.
            </p>
          )}

          {error && (
            <p className="qa-message qa-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="qa-primary" disabled={saving || !chosen}>
            {saving ? t('ex.saving') : onCancel ? t('ex.add') : t('ex.start')}
          </button>
        </form>
      )}

      {onCancel && (
        <button type="button" className="text-link" onClick={onCancel}>
          {t('ex.cancel')}
        </button>
      )}
    </section>
  );
}
