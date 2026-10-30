import { useMemo, useState } from 'react';
import { computeAnalytics, formatDays, formatGap, headline } from '../analytics';
import { subjectAccent } from '../subjects';

// The home screen: how the person is doing, in numbers and small charts.
// Charts are plain SVG/CSS (no chart library). Every chart has a hidden table
// for screen readers, and tooltips open on hover and on keyboard/tap focus.

const percent = (value) => `${Math.round(value * 100)}%`;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const shortDate = (date) =>
  date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

function Panel({ title, note, wide, action, children }) {
  return (
    <section className={wide ? 'dash-panel wide' : 'dash-panel'}>
      <header>
        <div>
          <h3>{title}</h3>
          {note && <p>{note}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

function Empty({ children }) {
  return <p className="dash-empty">{children}</p>;
}

function SrTable({ caption, head, rows }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {head.map((cell) => (
            <th key={cell}>{cell}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Kpi({ label, value, unit, sub }) {
  return (
    <article className="dash-kpi">
      <p className="dash-kpi-label">{label}</p>
      <p className="dash-kpi-value">
        {value}
        {unit && <span>{unit}</span>}
      </p>
      <p className="dash-kpi-sub">{sub}</p>
    </article>
  );
}

// Cards by stage, as a ring. Segments are separated by a 2px gap in the surface color.
const STAGE_COLORS = {
  new: 'var(--dash-new)',
  learning: 'var(--dash-learning)',
  strong: 'var(--dash-strong)',
  mastered: 'var(--dash-pos)',
};

function StageRing({ stages, total, masteredPct }) {
  const size = 176;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = stages.filter((stage) => stage.count > 0).length > 1 ? 2 : 0;
  let offset = 0;

  return (
    <div className="stage-ring">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${percent(masteredPct)} of cards mastered`}>
        <circle cx={size / 2} cy={size / 2} r={radius} className="ring-track" strokeWidth={stroke} fill="none" />
        {stages.map((stage) => {
          if (stage.count === 0) return null;

          const length = (stage.count / total) * circumference;
          const dash = Math.max(length - gap, 0.5);
          const circle = (
            <circle
              key={stage.id}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={STAGE_COLORS[stage.id]}
              strokeWidth={stroke}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              tabIndex={0}
            >
              <title>{`${stage.label}: ${plural(stage.count, 'card')}`}</title>
            </circle>
          );

          offset += length;
          return circle;
        })}
        <text x="50%" y="48%" textAnchor="middle" className="ring-value">
          {percent(masteredPct)}
        </text>
        <text x="50%" y="62%" textAnchor="middle" className="ring-label">
          mastered
        </text>
      </svg>

      <ul className="stage-legend">
        {stages.map((stage) => (
          <li key={stage.id}>
            <span className="swatch" style={{ background: STAGE_COLORS[stage.id] }} aria-hidden="true" />
            <span className="stage-name">
              {stage.label}
              <small>{stage.hint}</small>
            </span>
            <strong>{stage.count}</strong>
          </li>
        ))}
      </ul>

      <SrTable
        caption="Cards by stage"
        head={['Stage', 'Cards']}
        rows={stages.map((stage) => [stage.label, stage.count])}
      />
    </div>
  );
}

// Reviews per day, split into recalled and missed.
function ActivityBars({ days }) {
  const max = Math.max(1, ...days.map((day) => day.total));

  return (
    <div className="dash-cols" role="group" aria-label="Reviews per day, last 14 days">
      {days.map((day) => {
        const tip = `${shortDate(day.date)}: ${
          day.total === 0 ? 'no reviews' : `${day.recalled} recalled, ${day.missed} missed`
        }`;

        return (
          <div className={day.isToday ? 'dash-col today' : 'dash-col'} key={day.key}>
            <span className="dash-col-total">{day.total > 0 ? day.total : ''}</span>
            <div className="dash-col-track">
              <div
                className="dash-col-stack"
                style={{ height: `${(day.total / max) * 100}%` }}
                data-tip={tip}
                tabIndex={0}
                aria-label={tip}
              >
                {day.missed > 0 && <span className="seg miss" style={{ flexGrow: day.missed }} />}
                {day.recalled > 0 && <span className="seg hit" style={{ flexGrow: day.recalled }} />}
              </div>
            </div>
            <span className="dash-col-label">{day.date.getDate()}</span>
          </div>
        );
      })}
      <SrTable
        caption="Reviews per day"
        head={['Day', 'Recalled', 'Missed']}
        rows={days.map((day) => [shortDate(day.date), day.recalled, day.missed])}
      />
    </div>
  );
}

// Recall rate as a line, by day or by week. Only buckets that have reviews get a point.
function RecallTrend({ buckets, unit }) {
  const width = 480;
  const height = 210;
  const pad = { left: 42, right: 28, top: 22, bottom: 44 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const x = (i) => pad.left + (buckets.length === 1 ? innerW / 2 : (i / (buckets.length - 1)) * innerW);
  const y = (rate) => pad.top + (1 - rate) * innerH;
  const daily = unit === 'days';
  const points = buckets
    .map((bucket, i) => ({ ...bucket, i }))
    .filter((bucket) => bucket.rate !== null);
  const path = points.map((p, k) => `${k === 0 ? 'M' : 'L'}${x(p.i)},${y(p.rate)}`).join(' ');
  const last = points[points.length - 1];
  const shortMonthDay = (date) => date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const labelFor = (bucket, i) => {
    if (i === buckets.length - 1) return daily ? 'Today' : 'This week';
    return shortMonthDay(daily ? bucket.from : bucket.to);
  };
  // Evenly spaced x labels, counted back from the newest bucket so "Today" is
  // always shown and no two labels crowd each other.
  const stepPx = buckets.length > 1 ? innerW / (buckets.length - 1) : innerW;
  const labelStep = Math.max(1, Math.ceil(76 / stepPx));
  const labelIndexes = [];
  for (let i = buckets.length - 1; i >= 0; i -= labelStep) labelIndexes.unshift(i);
  const tipFor = (p) =>
    `${daily ? shortDate(p.from) : `${shortDate(p.from)} to ${shortDate(p.to)}`}: ${percent(p.rate)} recalled (${p.recalled} of ${p.total})`;

  return (
    <div className="dash-line">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Recall rate by ${daily ? 'day' : 'week'}`}>
        {[0, 0.5, 1].map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className="grid" />
            <text x={pad.left - 8} y={y(tick) + 4} textAnchor="end" className="axis">
              {percent(tick)}
            </text>
          </g>
        ))}
        {labelIndexes.map((i) => (
          <g key={i}>
            <line x1={x(i)} x2={x(i)} y1={pad.top + innerH} y2={pad.top + innerH + 6} className="tick" />
            <text x={x(i)} y={height - 14} textAnchor="middle" className="axis axis-x">
              {labelFor(buckets[i], i)}
            </text>
          </g>
        ))}
        {points.length > 1 && <path d={path} className="line-path" fill="none" />}
        {points.map((p) => {
          const tip = tipFor(p);
          return (
            <g key={p.i} className="pt" tabIndex={0} aria-label={tip}>
              <circle cx={x(p.i)} cy={y(p.rate)} r="14" className="pt-hit" />
              <circle cx={x(p.i)} cy={y(p.rate)} r={daily ? 4 : 5} className="pt-dot" />
              <text
                x={Math.min(Math.max(x(p.i), 110), width - 110)}
                y={Math.max(y(p.rate) - 12, 12)}
                textAnchor="middle"
                className="pt-tip"
              >
                {tip}
              </text>
            </g>
          );
        })}
        {last && (
          <text x={x(last.i)} y={last.rate < 0.3 ? y(last.rate) - 12 : y(last.rate) + 20} textAnchor="middle" className="end-label">
            {percent(last.rate)}
          </text>
        )}
      </svg>
      <SrTable
        caption={`Recall rate by ${daily ? 'day' : 'week'}`}
        head={[daily ? 'Day' : 'Week ending', 'Reviews', 'Recalled']}
        rows={buckets.map((bucket) => [shortDate(bucket.to), bucket.total, bucket.rate === null ? '-' : percent(bucket.rate)])}
      />
    </div>
  );
}

function TrendToggle({ unit, onChange }) {
  return (
    <div className="seg-toggle" role="group" aria-label="Chart range">
      {[
        ['days', 'Days'],
        ['weeks', 'Weeks'],
      ].map(([id, label]) => (
        <button key={id} type="button" aria-pressed={unit === id} className={unit === id ? 'on' : ''} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}

const TREND_KEY = 'mnemoq-trend-unit';

function readTrendUnit() {
  try {
    return localStorage.getItem(TREND_KEY) === 'weeks' ? 'weeks' : 'days';
  } catch {
    return 'days';
  }
}

function SubjectBars({ subjects }) {
  return (
    <ul className="subject-bars">
      {subjects.map((subject) => {
        const share = subject.total > 0 ? subject.mastered / subject.total : 0;

        return (
          <li key={subject.name} style={{ '--accent': subjectAccent(subject.name) }}>
            <div className="subject-bar-head">
              <span className="subject-bar-name">
                <span className="subject-dot" aria-hidden="true" />
                {subject.name}
              </span>
              <span className="subject-bar-count">
                {subject.mastered} of {plural(subject.total, 'card')} mastered
              </span>
            </div>
            <div
              className="subject-track"
              role="img"
              aria-label={`${subject.name}: ${subject.mastered} of ${subject.total} mastered`}
            >
              <div className="subject-fill" style={{ width: `${Math.max(share * 100, subject.mastered > 0 ? 4 : 0)}%` }} />
            </div>
            <p className="subject-bar-sub">
              {subject.rate !== null ? `${percent(subject.rate)} recalled` : 'Not enough reviews yet'}
              {subject.due > 0 ? ` · ${subject.due} due` : ''}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function Upcoming({ days }) {
  const max = Math.max(1, ...days.map((day) => day.count));

  return (
    <div className="dash-cols upcoming" role="group" aria-label="Cards coming due, next 7 days">
      {days.map((day) => {
        const tip = `${day.isToday ? 'Today' : shortDate(day.date)}: ${plural(day.count, 'card')} due`;

        return (
          <div className={day.isToday ? 'dash-col today' : 'dash-col'} key={day.key}>
            <span className="dash-col-total">{day.count > 0 ? day.count : ''}</span>
            <div className="dash-col-track">
              <div
                className="dash-col-stack"
                style={{ height: `${(day.count / max) * 100}%` }}
                data-tip={tip}
                tabIndex={0}
                aria-label={tip}
              >
                {day.count > 0 && <span className="seg due" style={{ flexGrow: 1 }} />}
              </div>
            </div>
            <span className="dash-col-label">
              {day.isToday ? 'Today' : day.date.toLocaleDateString(undefined, { weekday: 'short' })}
            </span>
          </div>
        );
      })}
      <SrTable
        caption="Cards due, next 7 days"
        head={['Day', 'Cards due']}
        rows={days.map((day) => [shortDate(day.date), day.count])}
      />
    </div>
  );
}

// The proof: each review of one card, with the real gap that came before it.
function JourneyStrip({ journey }) {
  const entries = journey.entries.slice(-8);

  return (
    <ol className="journey-strip">
      {entries.map((entry, i) => {
        const previous = entries[i - 1] || journey.entries[journey.entries.length - entries.length - 1];
        const gap = previous ? formatGap(entry.at - previous.at) : null;

        return (
          <li key={entry.id} className={entry.recalled ? 'hit' : 'miss'}>
            <span className="journey-gap">{gap ? `after ${gap}` : 'first try'}</span>
            <span className="journey-dot" aria-hidden="true" />
            <span className="journey-result">{entry.recalled ? 'Recalled' : 'Missed'}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Moments({ data }) {
  const { best, toughest, longestMemoryCards, stats } = data;
  const tiles = [];

  if (best) {
    tiles.push(
      <article className="moment moment-feature" key="best" style={{ '--accent': subjectAccent(best.card.subject) }}>
        <p className="eyebrow">YOUR STRONGEST MEMORY</p>
        <h4>&ldquo;{best.card.question}&rdquo;</h4>
        <p>
          You recalled this correctly <strong>{best.streak} times in a row</strong>, and the gap grew to{' '}
          <strong>{formatGap(best.longestGap)}</strong>. That is spaced repetition working.
        </p>
        <JourneyStrip journey={best} />
      </article>
    );
  }

  if (longestMemoryCards.length > 0) {
    const top = longestMemoryCards[0];

    tiles.push(
      <article className="moment" key="long">
        <p className="eyebrow">LONGEST MEMORY</p>
        <h4>{formatDays(top.reviewIntervalDays)}</h4>
        <p>
          &ldquo;{top.question}&rdquo; now only needs a review every {formatDays(top.reviewIntervalDays)}.
        </p>
      </article>
    );
  }

  if (stats.turnarounds > 0) {
    tiles.push(
      <article className="moment" key="comeback">
        <p className="eyebrow">COMEBACKS</p>
        <h4>{plural(stats.turnarounds, 'card')}</h4>
        <p>started as a miss and are now answered correctly. That is the whole point.</p>
      </article>
    );
  } else if (stats.mastered > 0) {
    tiles.push(
      <article className="moment" key="mastered">
        <p className="eyebrow">MISTAKES TURNED INTO KNOWLEDGE</p>
        <h4>{stats.mastered}</h4>
        <p>
          {stats.mastered === 1 ? 'card was' : 'cards were'} saved because you got {stats.mastered === 1 ? 'it' : 'them'} wrong.
          You now recall {stats.mastered === 1 ? 'it' : 'them'} reliably.
        </p>
      </article>
    );
  }

  if (toughest) {
    tiles.push(
      <article className="moment" key="tough">
        <p className="eyebrow">HARDEST WIN</p>
        <h4>Took {toughest.totalMissed + toughest.streak} tries</h4>
        <p>
          &ldquo;{toughest.card.question}&rdquo; fought back, and you mastered it anyway.
        </p>
      </article>
    );
  }

  if (stats.bestDay && stats.bestDay.count >= 3) {
    tiles.push(
      <article className="moment" key="day">
        <p className="eyebrow">BIGGEST DAY</p>
        <h4>{plural(stats.bestDay.count, 'review')}</h4>
        <p>
          on {shortDate(new Date(`${stats.bestDay.key}T00:00:00`))}.
        </p>
      </article>
    );
  }

  if (tiles.length === 0) {
    return (
      <Empty>
        Your proud moments show up here: cards you recall again and again, with the gaps getting longer. Finish a
        few review sessions to see the first one.
      </Empty>
    );
  }

  return <div className="moments">{tiles}</div>;
}

export function Badges({ badges }) {
  const earned = badges.filter((badge) => badge.earned).length;

  return (
    <>
      <p className="badge-count">
        {earned} of {badges.length} earned
      </p>
      <ul className="badges">
        {badges.map((badge) => (
          <li key={badge.id} className={badge.earned ? 'badge earned' : 'badge'}>
            <span className="badge-mark" aria-hidden="true">
              {badge.earned ? '✓' : `${badge.value}/${badge.goal}`}
            </span>
            <span className="badge-text">
              <strong>{badge.label}</strong>
              <small>{badge.desc}</small>
            </span>
            {badge.earned && <span className="sr-only">Earned</span>}
          </li>
        ))}
      </ul>
    </>
  );
}

export default function Dashboard({ cards, reviews, dueCount, showForm, onToggleAdd, onReview }) {
  const data = useMemo(() => computeAnalytics(cards, reviews, new Date()), [cards, reviews]);
  const { stats } = data;
  const message = headline(stats);

  const recentTotal = data.days.reduce((sum, day) => sum + day.total, 0);
  const [trendUnit, setTrendUnit] = useState(readTrendUnit);
  const trendBuckets = trendUnit === 'days' ? data.daily : data.weeks;
  const hasTrend = trendBuckets.some((bucket) => bucket.rate !== null);

  function changeTrendUnit(unit) {
    setTrendUnit(unit);

    try {
      localStorage.setItem(TREND_KEY, unit);
    } catch {
      // Not critical if it can't be remembered.
    }
  }

  return (
    <div className="dash">
      <section className="welcome-card dash-hero">
        <div className="dash-hero-text">
          <p className="eyebrow">YOUR PROGRESS</p>
          <h2>{message.title}</h2>
          <p>{message.body}</p>
          <div className="welcome-actions">
            <button type="button" onClick={onToggleAdd}>
              {showForm ? 'Close form' : '+ Add a card'}
            </button>
            {dueCount > 0 && (
              <button type="button" className="ghost-button" onClick={onReview}>
                Review now ({dueCount} due)
              </button>
            )}
          </div>
        </div>

        {stats.totalCards > 0 && (
          <div className="dash-hero-figure">
            <p className="dash-big">
              {stats.mastered}
              <span> / {stats.totalCards}</span>
            </p>
            <p className="dash-big-label">cards mastered</p>
            <div
              className="dash-meter"
              role="img"
              aria-label={`${percent(stats.masteredPct)} of your cards are mastered`}
            >
              <div style={{ width: `${Math.max(stats.masteredPct * 100, stats.mastered > 0 ? 3 : 0)}%` }} />
            </div>
          </div>
        )}
      </section>

      {stats.totalCards > 0 && (
        <>
          <section className="dash-kpis" aria-label="Your numbers">
            <Kpi
              label="Streak"
              value={stats.streak.current}
              unit={stats.streak.current === 1 ? ' day' : ' days'}
              sub={
                stats.streak.best > 0
                  ? `Best: ${plural(stats.streak.best, 'day')}`
                  : 'Review today to start one'
              }
            />
            <Kpi
              label="Reviews done"
              value={stats.reviewsTotal}
              sub={stats.reviewsTotal > 0 ? 'Each one strengthens memory' : 'Your first is a short session'}
            />
            <Kpi
              label="Recall rate"
              value={stats.recallRate === null ? '-' : percent(stats.recallRate)}
              sub={
                stats.recallRate === null
                  ? 'Shows after a few reviews'
                  : `${stats.recalledCount} of ${stats.historyCount} answers right`
              }
            />
            <Kpi
              label="Memory span"
              value={stats.longestIntervalDays > 0 ? formatDays(stats.longestIntervalDays) : '-'}
              sub={
                stats.avgIntervalDays > 0
                  ? `Longest gap. Average ${formatDays(stats.avgIntervalDays)}`
                  : 'Grows with every recall'
              }
            />
            <Kpi
              label="Learning for"
              value={stats.daysLearning}
              unit={stats.daysLearning === 1 ? ' day' : ' days'}
              sub={`${plural(stats.totalCards, 'card')} saved`}
            />
          </section>

          {stats.reviewsTotal > 0 && !stats.hasHistory && (
            <p className="dash-note">
              Daily activity and recall trends start building from your next review.
            </p>
          )}

          <div className="dash-grid">
            <Panel title="Where your cards stand" note="Cards move right as your gaps grow.">
              <StageRing stages={data.stages} total={Math.max(stats.totalCards, 1)} masteredPct={stats.masteredPct} />
            </Panel>

            <Panel
              title="Last 14 days"
              note={recentTotal > 0 ? `${plural(recentTotal, 'review')} in two weeks` : 'Reviews per day'}
            >
              {recentTotal > 0 ? (
                <>
                  <ActivityBars days={data.days} />
                  <p className="dash-legend" aria-hidden="true">
                    <span><i className="swatch hit" /> Recalled</span>
                    <span><i className="swatch miss" /> Missed</span>
                  </p>
                </>
              ) : (
                <Empty>Review a few cards and each day shows up here, split into recalled and missed.</Empty>
              )}
            </Panel>

            <Panel
              title="Recall rate"
              note={`Share of answers you got right, ${trendUnit === 'days' ? 'last 30 days' : 'week by week'}.`}
              action={<TrendToggle unit={trendUnit} onChange={changeTrendUnit} />}
            >
              {hasTrend ? (
                <RecallTrend buckets={trendBuckets} unit={trendUnit} />
              ) : (
                <Empty>{trendUnit === 'days' ? 'Your daily recall rate appears after your first review session.' : 'Your weekly recall rate appears after your first review session.'}</Empty>
              )}
            </Panel>

            <Panel title="By subject" note="Mastered cards out of everything you saved.">
              <SubjectBars subjects={data.subjects} />
            </Panel>

            <Panel title="Coming up" note="Cards due over the next week.">
              <Upcoming days={data.upcoming} />
            </Panel>

            <Panel title="Proud moments" note="Proof that it is sticking." wide>
              <Moments data={data} />
            </Panel>

            <Panel title="Milestones" wide>
              <Badges badges={data.badges} />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
