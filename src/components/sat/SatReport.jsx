import { useMemo, useState } from 'react';
import { missedAsCards } from '../../sat/answers';
import { DOMAINS, SECTIONS } from '../../sat/blueprint';
import { kindOf } from '../../sat/score';
import { formatClock } from '../../mocks';
import { LockIcon } from '../Pro';

// The report for one finished SAT set (also used to reopen past results).
// Free accounts see the first few explanations; the rest are part of Pro.

const LETTERS = ['A', 'B', 'C', 'D'];

const KIND_LABEL = { diag: 'Diagnostic', drill: 'Skill drill', module: 'Timed module', full: 'Full adaptive test' };

function verdict(pct) {
  if (pct >= 85) return 'Excellent. Keep this accuracy under the clock.';
  if (pct >= 70) return 'Solid. The misses below are your quickest gains.';
  if (pct >= 50) return 'A fair base. Work through each miss, then drill the weakest skill.';
  return 'Tough set. Read every explanation slowly; that is where the points are.';
}

function ScoreHead({ record, kind }) {
  const scored = record.sections.filter((s) => Number.isFinite(s.scaled));
  const pct = record.total > 0 ? Math.round((record.correct / record.total) * 100) : 0;

  if (kind === 'full' && scored.length === 2) {
    return (
      <div className="sat-score-head">
        <div className="sat-score-big">
          <b>{scored[0].scaled + scored[1].scaled}</b>
          <span>estimated total, out of 1600</span>
        </div>
        <div className="sat-score-parts">
          {scored.map((s) => (
            <div key={s.id}>
              <b>{s.scaled}</b>
              <span>{SECTIONS[s.id].name}</span>
              <small>
                {s.correct}/{s.total} correct · {s.route === 'hard' ? 'harder' : 'easier'} second module
              </small>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="sat-score-head">
      <div className="sat-score-big">
        <b>
          {record.correct}/{record.total}
        </b>
        <span>{pct}% correct</span>
      </div>
      {scored.length > 0 && (
        <div className="sat-score-parts">
          {scored.map((s) => (
            <div key={s.id}>
              <b>about {s.scaled}</b>
              <span>{SECTIONS[s.id].name}</span>
              <small>
                {s.correct}/{s.total} correct · section score, 200 to 800
              </small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SatReport({ title, record, access, change = null, saveError = '', onAddCards, onDrill, onUpgrade, children }) {
  const [added, setAdded] = useState(0);
  const [adding, setAdding] = useState(false);
  const kind = kindOf(record.source);
  const pct = record.total > 0 ? Math.round((record.correct / record.total) * 100) : 0;
  const cards = useMemo(() => missedAsCards(record.sections), [record]);
  const cardLimit = Math.min(cards.length, access.cardsPerReport);
  const misses = record.sections.flatMap((s) => (s.missed || []).map((m) => ({ ...m, section: s.id })));
  const lockedExplanations = Math.max(0, misses.length - access.explanations);

  // Skills in this set, weakest first, grouped under their domain.
  const domains = useMemo(() => {
    const byDomain = new Map();

    for (const section of record.sections) {
      for (const t of section.topics || []) {
        const entry = byDomain.get(t.domain) || { id: t.domain, name: DOMAINS[t.domain]?.name || t.domain, correct: 0, total: 0, skills: [] };

        entry.correct += t.correct;
        entry.total += t.total;
        entry.skills.push(t);
        byDomain.set(t.domain, entry);
      }
    }

    return [...byDomain.values()];
  }, [record]);

  const weakest = domains
    .flatMap((d) => d.skills)
    .filter((t) => t.correct < t.total)
    .sort((a, b) => a.correct / a.total - b.correct / b.total || b.total - a.total)[0];

  const timedOut = record.limitSeconds && record.seconds >= record.limitSeconds - 2;
  const perQuestion = record.total > 0 ? Math.round(record.seconds / record.total) : 0;

  async function addMissed() {
    setAdding(true);

    const outcome = await onAddCards(cards.slice(0, cardLimit));

    setAdding(false);
    setAdded(outcome?.added || 0);
  }

  return (
    <div className="sat-report">
      <div className="sat-panel sat-report-top">
        <p className="eyebrow">{(KIND_LABEL[kind] || 'Result').toUpperCase()} REPORT</p>
        <h3>{title}</h3>
        <ScoreHead record={record} kind={kind} />
        <p className="sat-muted">
          {verdict(pct)} Time: {formatClock(record.seconds)}
          {record.limitSeconds ? ` of ${formatClock(record.limitSeconds)}` : ''}
          {perQuestion > 0 && ` · about ${perQuestion} seconds a question`}
          {timedOut ? ' · time ran out, so your answers were submitted' : ''}
        </p>
        {change && change.before !== null && change.after !== null && (
          <p className="sat-change">
            {change.after === change.before ? (
              <>Your estimated score stays at <b>{change.after}</b>.</>
            ) : (
              <>
                Your estimated score moved from {change.before} to <b>{change.after}</b>.
              </>
            )}
          </p>
        )}
        {change && change.before === null && change.after !== null && (
          <p className="sat-change">
            Your first estimated score: <b>{change.after}</b>.
          </p>
        )}
        {kind !== 'drill' && <p className="sat-fineprint">Scores are Mnemoq estimates from the share of questions you got right. They help you plan; they are not official scores.</p>}
        {saveError && <p className="diag-error">Your result could not be saved: {saveError}</p>}
      </div>

      {domains.length > 0 && (
        <div className="sat-panel">
          <h3>By skill</h3>
          <div className="sat-report-domains">
            {domains.map((d) => (
              <div key={d.id}>
                <p className="sat-domain-name">
                  {d.name}
                  <span>
                    {d.correct}/{d.total}
                  </span>
                </p>
                <ul className="sat-skill-list compact">
                  {d.skills.map((t) => (
                    <li key={t.skill}>
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
              </div>
            ))}
          </div>
          {weakest && onDrill && (
            <div className="sat-callout">
              <p>
                <b>Work on first:</b> {weakest.topic} ({weakest.correct} of {weakest.total} here).
              </p>
              <button type="button" className="qa-primary" onClick={() => onDrill(weakest.skill)}>
                Drill this skill
              </button>
            </div>
          )}
        </div>
      )}

      {misses.length > 0 && (
        <div className="sat-panel">
          <h3>What you missed</h3>
          <ul className="sat-missed">
            {misses.map((m, i) => {
              const locked = i >= access.explanations;

              return (
                <li key={m.id}>
                  <p className="sat-missed-tag">
                    {SECTIONS[m.section].short} · {m.topic}
                  </p>
                  {m.passage && <p className="sat-missed-passage">{m.passage}</p>}
                  <p className="sat-missed-q">{m.question}</p>
                  <p className="sat-missed-answers">
                    <span className="wrong">You: {m.pickedText ? `${m.picked !== null && m.picked !== undefined ? `${LETTERS[m.picked]}) ` : ''}${m.pickedText}` : 'no answer'}</span>
                    <span className="right">Correct: {m.correct !== null && m.correct !== undefined ? `${LETTERS[m.correct]}) ` : ''}{m.correctText}</span>
                  </p>
                  {locked ? (
                    <p className="sat-locked-line">
                      <LockIcon /> The explanation for this question is part of Pro.
                    </p>
                  ) : (
                    m.explain && <p className="sat-explain">Why: {m.explain}</p>
                  )}
                </li>
              );
            })}
          </ul>

          {lockedExplanations > 0 && (
            <div className="sat-callout pro">
              <p>
                <b>{lockedExplanations} more {lockedExplanations === 1 ? 'explanation is' : 'explanations are'} waiting.</b> Knowing why you missed a question is what stops you missing it again.
              </p>
              <button type="button" className="qa-primary" onClick={() => onUpgrade('explain')}>
                Unlock every explanation
              </button>
            </div>
          )}

          {cards.length > 0 && onAddCards && (
            <div className="sat-actions">
              <button type="button" className="qa-primary" disabled={adding || added > 0} onClick={addMissed}>
                {added > 0
                  ? `${added} added to your cards`
                  : adding
                    ? 'Adding...'
                    : cardLimit < cards.length
                      ? `Add the first ${cardLimit} misses to my cards`
                      : `Add ${cards.length} ${cards.length === 1 ? 'miss' : 'misses'} to my cards`}
              </button>
              {cardLimit < cards.length && (
                <button type="button" className="text-link" onClick={() => onUpgrade('explain')}>
                  Add all {cards.length} with Pro
                </button>
              )}
            </div>
          )}
          <p className="sat-fineprint">Cards come back in your reviews just before you would forget them.</p>
        </div>
      )}

      {misses.length === 0 && record.total > 0 && (
        <div className="sat-panel">
          <h3>Nothing missed</h3>
          <p className="sat-muted">A clean set. Try a harder skill or a timed module next.</p>
        </div>
      )}

      {children}
    </div>
  );
}
