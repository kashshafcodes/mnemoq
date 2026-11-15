import { useMemo, useState } from 'react';
import { PATHS, getPath, scaleOf } from '../../paths';
import { daysLeftFor, describeProgress } from '../../readiness';
import { computeStreaks } from '../../analytics';
import { EXAM_FACTS, SECTIONS, SOURCES, skillName } from '../../sat/blueprint';
import { buildAchievements, buildMissions, buildStudyPlan, hasBaseline, nextStep } from '../../sat/coach';
import { ESSENTIAL_DECKS } from '../../sat/essentials';
import { kindOf, scoreHistory } from '../../sat/score';
import { AchievementsCard } from '../Missions';
import { LockIcon, ProBadge } from '../Pro';
import { pageHref } from '../../useRoute';

// The SAT home screen: the score estimate, what to do next, the skill map,
// practice, the score log and the plan to test day.

const todayString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const shortDate = (date) => new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const longDate = (date) => new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

export function describeResult(mock) {
  const kind = kindOf(mock.source);
  const parts = String(mock.source || '').split(':');

  if (kind === 'official') return 'Bluebook practice test';
  if (kind === 'full') return 'Full adaptive test';
  if (kind === 'module') return `Timed module · ${SECTIONS[parts[2]]?.short || ''}`;
  if (kind === 'diag') return 'Diagnostic';

  return `Drill · ${skillName(parts[3])}`;
}

// A half-circle from 400 to 1600: the estimate, its likely range, and the target.
function Gauge({ estimate, target }) {
  const R = 84;
  const at = (value) => {
    const share = Math.min(1, Math.max(0, (value - 400) / 1200));
    const angle = Math.PI * (1 - share);

    return [110 + R * Math.cos(angle), 104 - R * Math.sin(angle)];
  };
  const arc = (from, to) => {
    const [x0, y0] = at(from);
    const [x1, y1] = at(to);

    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  const score = estimate.overall;
  const [tx, ty] = at(target);
  const [ux, uy] = [110 + (R + 13) * Math.cos(Math.PI * (1 - (target - 400) / 1200)), 104 - (R + 13) * Math.sin(Math.PI * (1 - (target - 400) / 1200))];

  return (
    <svg className="sat-gauge" viewBox="0 0 220 132" role="img" aria-label={score === null ? 'No score estimate yet' : `Estimated score ${score}, likely between ${estimate.low} and ${estimate.high}. Target ${target}.`}>
      <defs>
        <linearGradient id="sat-gauge-fill" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <path className="sat-gauge-track" d={arc(400, 1600)} />
      {score !== null && <path className="sat-gauge-range" d={arc(estimate.low, estimate.high)} />}
      {score !== null && score > 400 && <path className="sat-gauge-value" d={arc(400, score)} stroke="url(#sat-gauge-fill)" />}
      <line className="sat-gauge-target" x1={tx} y1={ty} x2={ux} y2={uy} />
      <text x="110" y="92" textAnchor="middle" className="sat-gauge-score">
        {score === null ? '–' : score}
      </text>
      <text x="110" y="112" textAnchor="middle" className="sat-gauge-sub">
        {score === null ? 'no estimate yet' : `likely ${estimate.low}–${estimate.high}`}
      </text>
      <text x="26" y="128" textAnchor="middle" className="sat-gauge-end">400</text>
      <text x="194" y="128" textAnchor="middle" className="sat-gauge-end">1600</text>
    </svg>
  );
}

function HistoryChart({ points, target }) {
  if (points.length < 2) {
    return <p className="sat-muted">Your score line appears here after two scored results (a diagnostic, a full test or a logged Bluebook score).</p>;
  }

  const W = 560;
  const H = 180;
  const pad = { l: 40, r: 14, t: 14, b: 26 };
  const values = [...points.map((p) => p.total), target];
  const lo = Math.max(400, Math.floor((Math.min(...values) - 40) / 100) * 100);
  const hi = Math.min(1600, Math.ceil((Math.max(...values) + 40) / 100) * 100);
  const t0 = points[0].at.getTime();
  const t1 = points[points.length - 1].at.getTime();
  const x = (p) => pad.l + (t1 === t0 ? 0.5 : (p.at.getTime() - t0) / (t1 - t0)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const ticks = [];

  for (let v = lo; v <= hi; v += Math.max(100, Math.round((hi - lo) / 400) * 100)) ticks.push(v);

  return (
    <div className="sat-chart-wrap">
      <svg className="sat-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Score history: from ${points[0].total} to ${points[points.length - 1].total}. Target ${target}.`}>
        {ticks.map((v) => (
          <g key={v}>
            <line className="sat-chart-grid" x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} />
            <text className="sat-chart-label" x={pad.l - 6} y={y(v) + 4} textAnchor="end">{v}</text>
          </g>
        ))}
        {target >= lo && target <= hi && (
          <>
            <line className="sat-chart-target" x1={pad.l} x2={W - pad.r} y1={y(target)} y2={y(target)} />
            <text className="sat-chart-label target" x={W - pad.r} y={y(target) - 5} textAnchor="end">target {target}</text>
          </>
        )}
        <polyline className="sat-chart-line" points={points.map((p) => `${x(p).toFixed(1)},${y(p.total).toFixed(1)}`).join(' ')} />
        {points.map((p, i) => (
          <circle key={i} className={p.kind === 'official' ? 'sat-chart-dot official' : 'sat-chart-dot'} cx={x(p)} cy={y(p.total)} r="5">
            <title>{`${shortDate(p.at)}: ${p.total} (${p.kind === 'official' ? 'Bluebook' : 'Mnemoq estimate'})`}</title>
          </circle>
        ))}
        <text className="sat-chart-label" x={pad.l} y={H - 6}>{shortDate(points[0].at)}</text>
        <text className="sat-chart-label" x={W - pad.r} y={H - 6} textAnchor="end">{shortDate(points[points.length - 1].at)}</text>
      </svg>
      <p className="sat-legend">
        <span><i className="sat-key official" /> Bluebook (official practice)</span>
        <span><i className="sat-key" /> Mnemoq estimate</span>
      </p>
    </div>
  );
}

// Ready-made rule and formula cards. Which decks were added is remembered on
// this device, so the button does not offer the same cards twice.
function Essentials({ onAddCards }) {
  const key = (id) => `mnemoq-sat-deck-${id}`;
  const read = (id) => {
    try {
      return localStorage.getItem(key(id)) === '1';
    } catch {
      return false;
    }
  };
  const [added, setAdded] = useState(() => Object.fromEntries(ESSENTIAL_DECKS.map((d) => [d.id, read(d.id)])));
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function add(deck) {
    setBusy(deck.id);
    setError('');

    const result = await onAddCards(deck.cards);

    setBusy('');

    if (result?.error) {
      setError(`Some cards could not be added: ${result.error}`);
      return;
    }

    setAdded((current) => ({ ...current, [deck.id]: true }));

    try {
      localStorage.setItem(key(deck.id), '1');
    } catch {
      // Not critical: the button would just offer the deck again.
    }
  }

  return (
    <section className="path-card">
      <header>
        <h3>SAT essentials decks</h3>
        <p>The rules and formulas worth knowing by heart, as review cards. Add them once and your daily reviews do the rest.</p>
      </header>
      <div className="sat-practice">
        {ESSENTIAL_DECKS.map((deck) => (
          <article key={deck.id}>
            <h4>{deck.name}</h4>
            <p>
              {deck.cards.length} cards · {deck.detail}
            </p>
            <button type="button" className={added[deck.id] ? 'ghost-button' : 'qa-primary'} disabled={Boolean(busy) || added[deck.id]} onClick={() => add(deck)}>
              {added[deck.id] ? 'Added to your cards' : busy === deck.id ? 'Adding...' : `Add ${deck.cards.length} cards`}
            </button>
          </article>
        ))}
      </div>
      {error && <p className="diag-error" role="alert">{error}</p>}
    </section>
  );
}

function ScoreLog({ onLog }) {
  const [open, setOpen] = useState(false);
  const [rw, setRw] = useState('');
  const [math, setMath] = useState('');
  const [date, setDate] = useState(todayString());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const valid = (v) => Number.isInteger(Number(v)) && Number(v) >= 200 && Number(v) <= 800 && Number(v) % 10 === 0;

  async function submit(event) {
    event.preventDefault();

    if (!valid(rw) || !valid(math)) {
      setError('Section scores run from 200 to 800 in steps of 10.');
      return;
    }

    setBusy(true);
    setError('');

    const result = await onLog({ rw: Number(rw), math: Number(math), takenOn: date || todayString() });

    setBusy(false);

    if (result?.error) setError(result.error);
    else {
      setRw('');
      setMath('');
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="ghost-button" onClick={() => setOpen(true)}>
        Log a Bluebook or real SAT score
      </button>
    );
  }

  return (
    <form className="sat-log" onSubmit={submit}>
      <label>
        Reading and Writing
        <input type="number" inputMode="numeric" min="200" max="800" step="10" value={rw} onChange={(e) => setRw(e.target.value)} placeholder="200-800" required />
      </label>
      <label>
        Math
        <input type="number" inputMode="numeric" min="200" max="800" step="10" value={math} onChange={(e) => setMath(e.target.value)} placeholder="200-800" required />
      </label>
      <label>
        Taken on
        <input type="date" max={todayString()} value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="sat-actions">
        <button type="submit" className="qa-primary" disabled={busy}>
          {busy ? 'Saving...' : 'Save score'}
        </button>
        <button type="button" className="text-link" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {error && <p className="diag-error" role="alert">{error}</p>}
    </form>
  );
}

export default function SatDashboard({
  pathCfg,
  paths = [],
  plan,
  access,
  estimate,
  map,
  diagnostic,
  mocks,
  cards,
  reviews,
  bank,
  lockedQuestions,
  notice,
  onDismissNotice,
  onSavePath,
  onSwitch,
  onAddExam,
  onStart,
  onLogScore,
  onOpenReport,
  onUpgrade,
  onAddCards,
  onAnalyze,
  analyzing,
}) {
  const path = getPath(pathCfg.pathId);
  const scale = scaleOf(path);
  const daysLeft = daysLeftFor(pathCfg.examDate);
  const progress = describeProgress(estimate.overall, pathCfg.target, daysLeft, scale);
  const baseline = hasBaseline(estimate);
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(pathCfg.examDate || '');
  const [target, setTarget] = useState(pathCfg.target);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState('rw');

  const missions = useMemo(() => buildMissions({ estimate, map, cards, reviews, mocks, daysLeft }), [estimate, map, cards, reviews, mocks, daysLeft]);
  const step = useMemo(() => nextStep({ estimate, map, mocks }), [estimate, map, mocks]);
  const studyPlan = useMemo(() => buildStudyPlan({ estimate, target: pathCfg.target, daysLeft }), [estimate, pathCfg.target, daysLeft]);
  const history = useMemo(() => scoreHistory(diagnostic, mocks), [diagnostic, mocks]);
  const achievements = useMemo(
    () => buildAchievements({ estimate, map, cards, reviews, mocks, target: pathCfg.target, hasDiagnostic: Boolean(diagnostic) }),
    [estimate, map, cards, reviews, mocks, pathCfg.target, diagnostic]
  );
  const streak = useMemo(() => computeStreaks(reviews, new Date()).current, [reviews]);
  const others = paths.filter((p) => p.pathId !== pathCfg.pathId);
  const analysis = diagnostic?.analysis;

  async function saveSettings(event) {
    event.preventDefault();
    setSaving(true);
    await onSavePath({ pathId: pathCfg.pathId, examDate: date || null, target });
    setSaving(false);
    setEditing(false);
  }

  function act(action) {
    if (action.type === 'review') window.location.hash = pageHref('review').slice(1);
    else if (action.type === 'add') window.location.hash = pageHref('add').slice(1);
    else if (action.type === 'diagnostic') onStart({ kind: 'diag' });
    else if (action.type === 'drill') onStart({ kind: 'drill', skill: action.skill });
    else if (action.type === 'module') onStart({ kind: 'module', section: action.section || estimate.sections.filter((s) => s.score !== null).sort((a, b) => a.score - b.score)[0]?.id || 'rw' });
    else if (action.type === 'full') onStart({ kind: 'full' });
  }

  return (
    <div className="path sat">
      {notice && (
        <p className="path-notice" role="status">
          {notice}{' '}
          <button type="button" className="text-link" onClick={onDismissNotice}>
            Dismiss
          </button>
        </p>
      )}

      <nav className="sat-switch" aria-label="Your exams">
        <span className="sat-switch-chip on">{path.short}</span>
        {others.map((p) => (
          <button key={p.pathId} type="button" className="sat-switch-chip" onClick={() => onSwitch(p)}>
            {PATHS[p.pathId]?.short || p.pathId}
          </button>
        ))}
        <button type="button" className="sat-switch-chip add" onClick={onAddExam}>
          + Add an exam
        </button>
        <span className="sat-switch-plan">
          {plan.pro ? (
            <a className="pro-badge on" href={pageHref('pro')}>
              Pro · {plan.daysLeft} {plan.daysLeft === 1 ? 'day' : 'days'} left
            </a>
          ) : (
            <a className="pro-badge" href={pageHref('pro')}>
              <LockIcon /> Free plan · See Pro
            </a>
          )}
        </span>
      </nav>

      <section className="sat-hero">
        <div className="sat-hero-main">
          <p className="eyebrow">DIGITAL SAT</p>
          <h2>{baseline ? 'Your estimated score' : 'Your SAT path'}</h2>

          {daysLeft !== null ? (
            <p className="path-days">
              <b>{daysLeft}</b> {daysLeft === 1 ? 'day' : 'days'} to go
              <span> · test on {longDate(`${pathCfg.examDate}T00:00:00`)}</span>
            </p>
          ) : (
            <p className="path-days path-days-none">No test date set yet.</p>
          )}

          <p className="path-status">
            <span className={`path-pill ${progress.band}`}>{progress.label}</span>
            {progress.gap !== null && progress.gap > 0 && (
              <span>
                {progress.gap} points to your target of {pathCfg.target}
                {progress.perWeek ? `, about ${progress.perWeek} a week` : ''}
              </span>
            )}
            {progress.band === 'ready' && <span>You are at or above your target of {pathCfg.target}.</span>}
            {progress.band === 'unmeasured' && <span>Target {pathCfg.target}</span>}
          </p>

          <div className="sat-section-scores">
            {estimate.sections.map((s) => (
              <div key={s.id}>
                <span>{s.name}</span>
                <b>{s.score === null ? '–' : s.score}</b>
                <small>{s.score === null ? 'not measured' : `likely ${s.low}–${s.high}`}</small>
              </div>
            ))}
          </div>

          <div className="path-hero-actions">
            <button type="button" className="ghost-button" onClick={() => setEditing(!editing)} aria-expanded={editing}>
              {editing ? 'Close' : 'Test date & target'}
            </button>
          </div>

          {editing && (
            <form className="path-edit" onSubmit={saveSettings}>
              <label htmlFor="sat-date">Test date</label>
              <input id="sat-date" type="date" min={todayString()} value={date} onChange={(e) => setDate(e.target.value)} />
              <label htmlFor="sat-target">
                Target score: <b>{target}</b>
              </label>
              <input
                id="sat-target"
                type="range"
                className="fancy-range"
                style={{ '--fill': `${((target - scale.targetMin) / (scale.targetMax - scale.targetMin)) * 100}%` }}
                min={scale.targetMin}
                max={scale.targetMax}
                step={scale.step}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
              />
              <button type="submit" className="qa-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </form>
          )}
        </div>
        <Gauge estimate={estimate} target={pathCfg.target} />
      </section>

      <section className="sat-next">
        <div>
          <p className="eyebrow">NEXT BEST STEP</p>
          <h3>{step.title}</h3>
          <p>{step.detail}</p>
        </div>
        <button type="button" className="qa-primary" onClick={() => act(step.action)}>
          {step.action.label}
        </button>
      </section>

      {!baseline && (
        <section className="path-card">
          <header>
            <h3>Already have a score?</h3>
            <p>If you have taken a Bluebook practice test or a real SAT, enter the two section scores and skip straight to practice.</p>
          </header>
          <ScoreLog onLog={onLogScore} />
        </section>
      )}

      <section className="path-card missions">
        <header>
          <h3>Today</h3>
          <p>
            {missions.allDone ? 'All done for today. Come back tomorrow.' : `${missions.done} of ${missions.total} done`}
            {streak > 0 && ` · ${streak}-day streak`}
          </p>
        </header>
        <ul className="mission-list">
          {missions.missions.map((m) => (
            <li key={m.id} className={m.done ? 'mission done' : 'mission'}>
              <span className="mission-check" aria-hidden="true">
                {m.done ? '✓' : ''}
              </span>
              <div className="mission-body">
                <strong>{m.title}</strong>
                <p>{m.detail}</p>
                <div className="path-meter small" aria-hidden="true">
                  <span className={m.done ? 'good' : ''} style={{ width: `${(m.value / m.goal) * 100}%` }} />
                </div>
              </div>
              {!m.done && (
                <button type="button" className="ghost-button" onClick={() => act(m.action)}>
                  {m.action.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="path-card">
        <header className="sat-card-head">
          <div>
            <h3>Skill map</h3>
            <p>The skills the SAT tests, from your answers in the last 60 days. Three answers are needed before a skill is rated.</p>
          </div>
          <div className="sat-tabs" role="tablist" aria-label="Section">
            {map.sections.map((s) => (
              <button key={s.id} type="button" role="tab" aria-selected={tab === s.id} className={tab === s.id ? 'sat-tab on' : 'sat-tab'} onClick={() => setTab(s.id)}>
                {SECTIONS[s.id].short}
              </button>
            ))}
          </div>
        </header>
        <div className="sat-domains">
          {map.sections
            .find((s) => s.id === tab)
            .domains.map((d) => (
              <div key={d.id} className="sat-domain">
                <p className="sat-domain-name">
                  {d.name}
                  <span>{d.pct === null ? 'not tried' : `${d.pct}%`}</span>
                </p>
                <ul className="sat-skill-list">
                  {d.skills.map((s) => (
                    <li key={s.id} className={s.state}>
                      <span>{s.name}</span>
                      <div className="path-meter small" aria-hidden="true">
                        <span style={{ width: `${s.state === 'unseen' ? 0 : s.pct}%` }} />
                      </div>
                      <b>{s.state === 'unseen' ? '–' : `${s.pct}%`}</b>
                      <button type="button" className="sat-chip" onClick={() => onStart({ kind: 'drill', skill: s.id })} aria-label={`Drill ${s.name}`}>
                        Drill
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
        <p className="sat-legend">
          <span><i className="sat-key strong" /> Strong (80%+)</span>
          <span><i className="sat-key ok" /> Getting there</span>
          <span><i className="sat-key weak" /> Needs work</span>
          <span><i className="sat-key unseen" /> Not rated yet</span>
        </p>
        {!access.pro && (
          <p className="sat-fineprint">
            Free plan: {access.drill.allowed ? 'one drill today' : 'today\'s free drill is used'}, from a starter set of {bank.length} questions.{' '}
            <button type="button" className="text-link" onClick={() => onUpgrade('bank', `Pro unlocks ${lockedQuestions} more questions and unlimited drills.`)}>
              Unlock {lockedQuestions} more questions
            </button>
          </p>
        )}
      </section>

      <section className="path-card">
        <header>
          <h3>Timed practice</h3>
          <p>Accuracy first, then accuracy under the clock.</p>
        </header>
        <div className="sat-practice">
          {['rw', 'math'].map((id) => {
            const gate = access.module(id);

            return (
              <article key={id}>
                <h4>{SECTIONS[id].name} module</h4>
                <p>
                  {SECTIONS[id].moduleQuestions} questions · {SECTIONS[id].moduleMinutes} minutes
                </p>
                <button type="button" className={gate.allowed ? 'qa-primary' : 'ghost-button'} onClick={() => onStart({ kind: 'module', section: id })}>
                  {!gate.allowed && <LockIcon />} Start
                </button>
                {!access.pro && <small>{gate.allowed ? 'One free module' : 'Free module used'}</small>}
              </article>
            );
          })}
          <article className="wide">
            <h4>
              Full adaptive test {!access.pro && <ProBadge />}
            </h4>
            <p>All four modules with a break, about 2 hours 15 minutes. The second module of each section adapts to your first, and you get a 400-1600 estimate.</p>
            <button type="button" className={access.pro ? 'qa-primary' : 'ghost-button'} onClick={() => onStart({ kind: 'full' })}>
              {!access.pro && <LockIcon />} Start a full test
            </button>
          </article>
        </div>
      </section>

      <Essentials onAddCards={onAddCards} />

      <section className="path-card">
        <header>
          <h3>Score history</h3>
          <p>Official Bluebook scores count most towards your estimate. Take one every few weeks and log it here.</p>
        </header>
        <HistoryChart points={history} target={pathCfg.target} />
        {baseline && <ScoreLog onLog={onLogScore} />}
      </section>

      <section className={access.plan.allowed ? 'path-card' : 'path-card sat-gated'}>
        <header>
          <h3>
            Your plan to test day {!access.plan.allowed && <ProBadge />}
          </h3>
          <p>
            {studyPlan.noDate ? 'No test date yet, so this plans twelve weeks from today. ' : `${studyPlan.weeks} ${studyPlan.weeks === 1 ? 'week' : 'weeks'} to go. `}
            {studyPlan.pointsPerWeek ? `To reach ${pathCfg.target} you need about ${studyPlan.pointsPerWeek} points a week.` : ''}
          </p>
        </header>
        <ol className="sat-plan">
          {studyPlan.phases.map((phase, i) => {
            const hidden = !access.plan.allowed && i > 0;

            return (
              <li key={phase.id} className={phase.current ? 'current' : ''}>
                <div className="sat-plan-head">
                  <strong>{phase.name}</strong>
                  <span>
                    {phase.from === phase.to ? `Week ${phase.from}` : `Weeks ${phase.from}–${phase.to}`} · from {shortDate(phase.startsOn)}
                  </span>
                  {phase.milestone !== null && <b>{hidden ? '••••' : `aim for ${phase.milestone}`}</b>}
                </div>
                <ul className={hidden ? 'blurred' : ''} aria-hidden={hidden}>
                  {phase.focus.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
        {!access.plan.allowed && (
          <div className="sat-callout pro">
            <p>
              <b>See the whole plan.</b> Pro lays out every phase with a score milestone for each, updated as your estimate moves.
            </p>
            <button type="button" className="qa-primary" onClick={() => onUpgrade('plan', access.plan.reason)}>
              Unlock my plan
            </button>
          </div>
        )}
      </section>

      {diagnostic && (
        <section className={access.coach.allowed ? 'path-card path-ai' : 'path-card sat-gated'}>
          <header>
            <h3>
              AI coach analysis {!access.coach.allowed && <ProBadge />}
            </h3>
            <p>A written read of your diagnostic: what to fix first and how. Based only on your measured results.</p>
          </header>
          {!access.coach.allowed ? (
            <button type="button" className="ghost-button" onClick={() => onUpgrade('coach', access.coach.reason)}>
              <LockIcon /> Unlock the AI coach
            </button>
          ) : analysis ? (
            <>
              <p className="path-summary">{analysis.summary}</p>
              {analysis.weaknesses?.length > 0 && (
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
              {analysis.focus?.length > 0 && (
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
            <button type="button" className="qa-primary" disabled={analyzing} onClick={onAnalyze}>
              {analyzing ? 'The AI is reading your results...' : 'Run the AI analysis'}
            </button>
          )}
        </section>
      )}

      <section className="path-card">
        <header>
          <h3>Your results</h3>
          <p>{mocks.length === 0 && !diagnostic ? 'Reports appear here after your first set.' : 'Open any past report.'}</p>
        </header>
        {(mocks.length > 0 || diagnostic) && (
          <ul className="sat-results">
            {[...mocks, ...(diagnostic ? [{ id: 'diag', source: 'sat:diag', createdAt: diagnostic.createdAt, sections: diagnostic.sections, isDiagnostic: true }] : [])]
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
              .slice(0, 12)
              .map((m) => {
                const kind = kindOf(m.source);
                const scored = (m.sections || []).filter((s) => Number.isFinite(s.scaled));
                const correct = (m.sections || []).reduce((sum, s) => sum + (s.correct || 0), 0);
                const total = (m.sections || []).reduce((sum, s) => sum + (s.total || 0), 0);

                return (
                  <li key={m.id}>
                    <span>{shortDate(m.sections?.[0]?.takenOn ? `${m.sections[0].takenOn}T12:00:00` : m.createdAt)}</span>
                    <strong>{describeResult(m)}</strong>
                    <b>{scored.length === 2 ? scored[0].scaled + scored[1].scaled : kind === 'official' ? '' : `${correct}/${total}`}</b>
                    {kind === 'official' ? (
                      <small>
                        {scored.map((s) => `${SECTIONS[s.id].short} ${s.scaled}`).join(' · ')}
                      </small>
                    ) : (
                      <button type="button" className="text-link" onClick={() => onOpenReport(m)}>
                        Report
                      </button>
                    )}
                  </li>
                );
              })}
          </ul>
        )}
        {diagnostic && (
          <button type="button" className="ghost-button" onClick={() => onStart({ kind: 'diag' })}>
            Retake the diagnostic
          </button>
        )}
      </section>

      <AchievementsCard items={achievements} />

      <section className="path-card path-exam">
        <header>
          <h3>About the digital SAT</h3>
          <p>{path.exam.summary}</p>
        </header>
        <ul className="path-strong">
          {EXAM_FACTS.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
        <p className="path-hint">
          {path.exam.note}{' '}
          {SOURCES.map((s, i) => (
            <span key={s.url}>
              {i > 0 && ' · '}
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.label}
              </a>
            </span>
          ))}
        </p>
        <p className="path-hint">
          Every Mnemoq question is original. Your score here is an estimate with a range, built from your results; College Board does not
          publish how the real test is scored. Use the free official Bluebook practice tests as your true checkpoints and log them above.
        </p>
      </section>
    </div>
  );
}
