import { useMemo, useState } from 'react';
import { getPath } from '../paths';
import { computeReadiness, daysLeftFor, describeProgress } from '../readiness';
import { computeStreaks } from '../analytics';
import { buildAchievements, buildMissions } from '../missions';
import AiBadge from './AiBadge';
import { AchievementsCard, MissionsCard } from './Missions';

const todayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const CRITERIA = [
  ['content', 'Content & ideas'],
  ['organization', 'Organisation'],
  ['language', 'Language'],
  ['grammar', 'Grammar'],
];

function Ring({ value }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const filled = value === null ? 0 : (Math.min(100, value) / 100) * circumference;

  return (
    <svg className="path-ring" viewBox="0 0 120 120" role="img" aria-label={value === null ? 'Readiness not measured yet' : `Readiness ${value} out of 100`}>
      <circle className="ring-track" cx="60" cy="60" r={radius} fill="none" strokeWidth="10" />
      <circle
        className="ring-fill"
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        transform="rotate(-90 60 60)"
      />
      <text x="60" y="62" textAnchor="middle" className="ring-value">
        {value === null ? '–' : value}
      </text>
      <text x="60" y="82" textAnchor="middle" className="ring-sub">
        readiness
      </text>
    </svg>
  );
}

export default function PathDashboard({
  pathCfg,
  diagnostic,
  cards,
  reviews,
  notice,
  onDismissNotice,
  onSavePath,
  onStartDiagnostic,
  onAnalyze,
  analyzing,
  missedCount,
  addedCount,
  onAddMissed,
  adding,
  canReview,
  onReviewSubject,
}) {
  const path = getPath(pathCfg.pathId);
  const readiness = useMemo(
    () => computeReadiness(pathCfg.pathId, diagnostic, reviews, new Date()),
    [pathCfg.pathId, diagnostic, reviews]
  );
  const daysLeft = daysLeftFor(pathCfg.examDate);
  const progress = describeProgress(readiness?.overall ?? null, pathCfg.target, daysLeft);
  const plan = useMemo(
    () => buildMissions({ daysLeft: daysLeftFor(pathCfg.examDate), readiness, cards, reviews, hasDiagnostic: Boolean(diagnostic) }),
    [pathCfg.examDate, readiness, cards, reviews, diagnostic]
  );
  const achievements = useMemo(
    () => buildAchievements({ cards, reviews, readiness, target: pathCfg.target, hasDiagnostic: Boolean(diagnostic) }),
    [cards, reviews, readiness, pathCfg.target, diagnostic]
  );
  const streak = useMemo(() => computeStreaks(reviews, new Date()).current, [reviews]);
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(pathCfg.examDate || '');
  const [target, setTarget] = useState(pathCfg.target);
  const [saving, setSaving] = useState(false);

  if (!path || !readiness) return null;

  const analysis = diagnostic?.analysis;
  const essay = diagnostic?.essay;
  const sectionsLeftToAdd = Math.max(0, missedCount - addedCount);

  async function saveSettings(event) {
    event.preventDefault();
    setSaving(true);
    await onSavePath({ pathId: pathCfg.pathId, examDate: date || null, target });
    setSaving(false);
    setEditing(false);
  }

  return (
    <div className="path">
      {notice && (
        <p className="path-notice" role="status">
          {notice}{' '}
          <button type="button" className="text-link" onClick={onDismissNotice}>
            Dismiss
          </button>
        </p>
      )}

      <section className="path-hero">
        <div className="path-hero-main">
          <p className="eyebrow">YOUR EXAM PATH</p>
          <h2>
            {path.name} <AiBadge>AI-coached</AiBadge>
          </h2>

          {daysLeft !== null ? (
            <p className="path-days">
              <b>{daysLeft}</b> {daysLeft === 1 ? 'day' : 'days'} to go
              <span> · exam on {new Date(`${pathCfg.examDate}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </p>
          ) : (
            <p className="path-days path-days-none">No exam date set yet.</p>
          )}

          <p className="path-status">
            <span className={`path-pill ${progress.band}`}>{progress.label}</span>
            {progress.gap !== null && progress.gap > 0 && (
              <span>
                {progress.gap} {progress.gap === 1 ? 'point' : 'points'} to your target of {pathCfg.target}
                {progress.perWeek ? `, about ${progress.perWeek} a week` : ''}
              </span>
            )}
            {progress.band === 'ready' && <span>You are at or above your target of {pathCfg.target}.</span>}
          </p>

          <div className="path-hero-actions">
            <button type="button" className="ghost-button" onClick={() => setEditing(!editing)} aria-expanded={editing}>
              {editing ? 'Close' : 'Exam date & target'}
            </button>
            {diagnostic && (
              <button type="button" className="ghost-button" onClick={onStartDiagnostic}>
                Retake the diagnostic
              </button>
            )}
          </div>

          {editing && (
            <form className="path-edit" onSubmit={saveSettings}>
              <label htmlFor="edit-date">Exam date</label>
              <input id="edit-date" type="date" min={todayString()} value={date} onChange={(e) => setDate(e.target.value)} />
              <label htmlFor="edit-target">
                Target readiness: <b>{target}</b>
              </label>
              <input id="edit-target" type="range" min="40" max="95" step="5" value={target} onChange={(e) => setTarget(Number(e.target.value))} />
              <button type="submit" className="qa-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </form>
          )}
        </div>

        <Ring value={readiness.overall} />
      </section>

      <MissionsCard
        plan={plan}
        streak={streak}
        onStartDiagnostic={onStartDiagnostic}
        onReviewSubject={onReviewSubject}
        canReview={canReview}
      />

      {!diagnostic && (
        <section className="path-cta">
          <h3>
            Start with your free AI diagnostic <AiBadge />
          </h3>
          <p>
            About 20 minutes. The AI tests every part of the {path.short} exam, marks your essay and shows exactly which
            topics to fix first. Your readiness score appears when you finish.
          </p>
          <button type="button" className="qa-primary" onClick={onStartDiagnostic}>
            Start the diagnostic
          </button>
        </section>
      )}

      {diagnostic && (
        <>
          <section className="path-card">
            <header>
              <h3>Your sections</h3>
              <p>
                From your diagnostic{readiness.sections.some((s) => s.practiceScore !== null) ? ' and your recent reviews' : ''}.
                {readiness.coverage < 1 && ' Some sections are not measured yet.'}
              </p>
            </header>
            <ul className="path-sections">
              {readiness.sections.map((s) => (
                <li key={s.id}>
                  <div className="path-section-head">
                    <strong>{s.name}</strong>
                    <span className="path-marks">{s.marks} of {path.totalMarks} marks</span>
                    <b className="path-score">{s.score === null ? 'Not measured' : s.score}</b>
                  </div>
                  <div className="path-meter" aria-hidden="true">
                    <span className={s.score !== null && s.score >= pathCfg.target ? 'good' : ''} style={{ width: `${s.score ?? 0}%` }} />
                    <i style={{ left: `${pathCfg.target}%` }} />
                  </div>
                  <p className="path-detail">
                    {s.diagScore !== null && `Diagnostic ${s.diagScore}`}
                    {s.practiceScore !== null && ` · Practice ${s.practiceScore}% over ${s.practiceCount} reviews`}
                    {s.diagScore === null && s.practiceScore === null && 'Retake the diagnostic to measure this section.'}
                    {s.aiMarked && s.diagScore !== null && ' · marked by AI'}
                  </p>
                  {canReview(s.cardSubject) && (
                    <button type="button" className="text-link" onClick={() => onReviewSubject(s.cardSubject)}>
                      Review {s.cardSubject} cards
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section className="path-card path-ai">
            <header>
              <h3>
                AI coach analysis <AiBadge />
              </h3>
              <p>Based on your measured results, never guesses.</p>
            </header>

            {analysis ? (
              <>
                <p className="path-summary">{analysis.summary}</p>

                {analysis.weaknesses.length > 0 && (
                  <>
                    <h4>Fix these first</h4>
                    <ul className="path-weak">
                      {analysis.weaknesses.map((w) => (
                        <li key={`${w.section}-${w.area}`}>
                          <strong>{w.area}</strong>
                          <p>{w.detail}</p>
                          <p className="path-fix">
                            <b>Do this:</b> {w.fix}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {analysis.strengths.length > 0 && (
                  <>
                    <h4>Keep doing well</h4>
                    <ul className="path-strong">
                      {analysis.strengths.map((s) => (
                        <li key={s.area}>
                          <strong>{s.area}.</strong> {s.detail}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {analysis.focus.length > 0 && (
                  <>
                    <h4>This week</h4>
                    <ol className="path-focus">
                      {analysis.focus.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ol>
                  </>
                )}
              </>
            ) : (
              <div className="path-retry">
                <p>The AI analysis is not ready for this diagnostic.</p>
                <button type="button" className="qa-primary" disabled={analyzing} onClick={onAnalyze}>
                  {analyzing ? 'The AI is reading your results...' : 'Run the AI analysis'}
                </button>
              </div>
            )}
          </section>

          {essay && (
            <section className="path-card">
              <header>
                <h3>
                  Essay feedback <AiBadge />
                </h3>
                <p>
                  {essay.score} out of 100 · {essay.words} words
                </p>
              </header>
              <ul className="path-criteria">
                {CRITERIA.map(([key, label]) => (
                  <li key={key}>
                    <span>{label}</span>
                    <div className="path-meter small" aria-hidden="true">
                      <span style={{ width: `${(essay.criteria[key] / 25) * 100}%` }} />
                    </div>
                    <b>{essay.criteria[key]}/25</b>
                  </li>
                ))}
              </ul>
              {essay.improvements.length > 0 && (
                <ul className="path-strong">
                  {essay.improvements.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              {essay.nextStep && (
                <p className="path-fix">
                  <b>Next step:</b> {essay.nextStep}
                </p>
              )}
            </section>
          )}

          {missedCount > 0 && (
            <section className="path-card">
              <header>
                <h3>Turn your misses into review cards</h3>
                <p>
                  {missedCount} questions you missed can become flashcards, so spaced repetition brings them back until
                  they stick.
                </p>
              </header>
              <button type="button" className="qa-primary" disabled={adding || sectionsLeftToAdd === 0} onClick={onAddMissed}>
                {sectionsLeftToAdd === 0
                  ? 'Added to your cards'
                  : adding
                    ? 'Adding...'
                    : `Add ${sectionsLeftToAdd} ${sectionsLeftToAdd === 1 ? 'card' : 'cards'}`}
              </button>
            </section>
          )}
        </>
      )}

      <AchievementsCard items={achievements} />

      <section className="path-card path-exam">
        <header>
          <h3>About the {path.short} exam</h3>
          <p>{path.exam.summary}</p>
        </header>
        <ul className="path-strong">
          {path.exam.details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        <p className="path-hint">
          {path.exam.note}{' '}
          <a href={path.exam.source.url} target="_blank" rel="noreferrer">
            {path.exam.source.label}
          </a>
        </p>
        <p className="path-hint">
          Readiness is an estimate from your diagnostic and your practice. It helps you plan; it does not predict your
          exam result.
        </p>
      </section>
    </div>
  );
}
