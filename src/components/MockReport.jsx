import { useMemo, useState } from 'react';
import { missedAsCards } from '../diagnosticScore';
import { LETTERS, formatClock, pctOf } from '../mocks';

// The report for one finished mock test (also used to reopen past results).

const CRITERIA = [
  ['content', 'Content & ideas'],
  ['organization', 'Organisation'],
  ['language', 'Language'],
  ['grammar', 'Grammar'],
];

function verdict(pct) {
  if (pct >= 80) return 'Strong result.';
  if (pct >= 60) return 'Solid, with room to grow.';
  if (pct >= 40) return 'Building up. The missed questions below show where to start.';
  return 'A tough one. Work through the explanations below, then try the next mock.';
}

export default function MockReport({ title, record, before = null, after = null, saveError = '', onAddCards, children }) {
  const [added, setAdded] = useState(0);
  const [adding, setAdding] = useState(false);
  const cards = useMemo(() => missedAsCards({ sections: record.sections }), [record]);
  const pct = pctOf(record);
  const essay = record.sections.find((s) => s.essay)?.essay;
  const quiz = record.sections.filter((s) => !s.essay);
  const topics = quiz.flatMap((s) => s.topics.map((t) => ({ ...t, section: s.name }))).sort((a, b) => a.correct / a.total - b.correct / b.total);
  const weak = topics.filter((t) => t.correct < t.total);
  const timedOut = record.limitSeconds && record.seconds >= record.limitSeconds - 1;

  async function addMissed() {
    setAdding(true);

    const outcome = await onAddCards(cards);

    setAdding(false);
    setAdded(outcome?.added || 0);
  }

  return (
    <div className="mock-report">
      <div className="diag-card">
        <p className="eyebrow">REPORT</p>
        <h3>{title}</h3>
        <div className="report-score">
          <b>{essay ? record.correct : `${record.correct}/${record.total}`}</b>
          <span>{essay ? 'out of 100' : `${pct}%`}</span>
        </div>
        <p className="diag-note">
          {verdict(pct)} Time: {formatClock(record.seconds)}
          {record.limitSeconds ? ` of ${formatClock(record.limitSeconds)}` : ''}
          {timedOut ? ' (time ran out, your answers were submitted)' : ''}
        </p>
        {saveError && <p className="diag-error">Your result could not be saved: {saveError}</p>}
        {before !== null && after !== null && (
          <p className="path-fix">
            {after === before ? `Your exam readiness stays at ${after}.` : `Your exam readiness moved from ${before} to `}
            {after !== before && <b>{after}</b>}
            {after !== before && '.'}
          </p>
        )}
      </div>

      {essay && (
        <div className="diag-card">
          <h3>Essay marking</h3>
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
          {essay.strengths?.length > 0 && (
            <>
              <h4>What worked</h4>
              <ul className="path-strong">
                {essay.strengths.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </>
          )}
          {essay.improvements?.length > 0 && (
            <>
              <h4>Improve next time</h4>
              <ul className="path-strong">
                {essay.improvements.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </>
          )}
          {essay.nextStep && (
            <p className="path-fix">
              <b>Next step:</b> {essay.nextStep}
            </p>
          )}
        </div>
      )}

      {topics.length > 0 && (
        <div className="diag-card">
          <h3>By topic</h3>
          <ul className="path-criteria report-topics">
            {topics.map((t) => (
              <li key={`${t.section}-${t.topic}`}>
                <span>{t.topic}</span>
                <div className="path-meter small" aria-hidden="true">
                  <span className={t.correct === t.total ? 'good' : ''} style={{ width: `${(t.correct / t.total) * 100}%` }} />
                </div>
                <b>
                  {t.correct}/{t.total}
                </b>
              </li>
            ))}
          </ul>
          {weak.length > 0 && (
            <p className="path-fix">
              <b>Work on first:</b> {weak.slice(0, 3).map((t) => t.topic).join(', ')}.
            </p>
          )}
        </div>
      )}

      {quiz.some((s) => s.missed.length > 0) && (
        <div className="diag-card">
          <h3>What you missed</h3>
          <ul className="mock-missed">
            {quiz.flatMap((s) =>
              s.missed.map((m) => (
                <li key={`${s.id}-${m.question}`}>
                  <p>{m.question}</p>
                  <small>
                    You: {m.picked === null || m.picked === undefined ? 'no answer' : `${LETTERS[m.picked]}) ${m.options[m.picked]}`} · Correct: {LETTERS[m.correct]}) {m.options[m.correct]}
                  </small>
                  {m.explain && <small className="report-explain">Why: {m.explain}</small>}
                </li>
              ))
            )}
          </ul>
          {cards.length > 0 && onAddCards && (
            <button type="button" className="qa-primary" disabled={adding || added > 0} onClick={addMissed}>
              {added > 0 ? `${added} added to your cards` : adding ? 'Adding...' : `Add ${cards.length} missed ${cards.length === 1 ? 'question' : 'questions'} to my cards`}
            </button>
          )}
        </div>
      )}

      {children}
    </div>
  );
}
