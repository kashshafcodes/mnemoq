import { useMemo, useState } from 'react';
import { streakTimes } from '../streak/activity';
import { computeAnalytics, headline } from '../analytics';
import { subjectAccent } from '../subjects';
import { useDashT } from '../progress/dashStrings';

// The home screen: how the person is doing, in numbers and small charts.
// Charts are plain SVG/CSS (no chart library). Every chart has a hidden table
// for screen readers, and tooltips open on hover and on keyboard/tap focus.

const percent = (value) => `${Math.round(value * 100)}%`;

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
  const t = useDashT();
  const size = 176;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = stages.filter((stage) => stage.count > 0).length > 1 ? 2 : 0;
  let offset = 0;

  return (
    <div className="stage-ring">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={t('d.ring.aria', { pct: percent(masteredPct) })}>
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
              <title>{`${t(`d.stage.${stage.id}`, {}, stage.label)}: ${t.n('d.card', stage.count)}`}</title>
            </circle>
          );

          offset += length;
          return circle;
        })}
        <text x="50%" y="48%" textAnchor="middle" className="ring-value">
          {t('d.n', { n: percent(masteredPct) })}
        </text>
        <text x="50%" y="62%" textAnchor="middle" className="ring-label">
          {t('d.mastered')}
        </text>
      </svg>

      <ul className="stage-legend">
        {stages.map((stage) => (
          <li key={stage.id}>
            <span className="swatch" style={{ background: STAGE_COLORS[stage.id] }} aria-hidden="true" />
            <span className="stage-name">
              {t(`d.stage.${stage.id}`, {}, stage.label)}
              <small>{t(`d.stage.${stage.id}.hint`, {}, stage.hint)}</small>
            </span>
            <strong>{t('d.n', { n: stage.count })}</strong>
          </li>
        ))}
      </ul>

      <SrTable
        caption={t('d.stage.caption')}
        head={[t('d.stage.head.stage'), t('d.stage.head.cards')]}
        rows={stages.map((stage) => [t(`d.stage.${stage.id}`, {}, stage.label), stage.count])}
      />
    </div>
  );
}

// Reviews per day, split into recalled and missed.
function ActivityBars({ days }) {
  const t = useDashT();
  const shortDate = (date) => t.date(date);
  const max = Math.max(1, ...days.map((day) => day.total));

  return (
    <div className="dash-cols" role="group" aria-label={t('d.bars.aria')}>
      {days.map((day) => {
        const tip = `${shortDate(day.date)}: ${
          day.total === 0 ? t('d.bars.none') : t('d.bars.tip', { recalled: day.recalled, missed: day.missed })
        }`;

        return (
          <div className={day.isToday ? 'dash-col today' : 'dash-col'} key={day.key}>
            <span className="dash-col-total">{day.total > 0 ? t('d.n', { n: day.total }) : ''}</span>
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
            <span className="dash-col-label">{t('d.n', { n: day.date.getDate() })}</span>
          </div>
        );
      })}
      <SrTable
        caption={t('d.bars.caption')}
        head={[t('d.head.day'), t('d.head.recalled'), t('d.head.missed')]}
        rows={days.map((day) => [shortDate(day.date), day.recalled, day.missed])}
      />
    </div>
  );
}

// Recall rate as a line, by day or by week. Only buckets that have reviews get a point.
function RecallTrend({ buckets, unit }) {
  const t = useDashT();
  const shortDate = (date) => t.date(date);
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
  const shortMonthDay = (date) => t.date(date, { day: 'numeric', month: 'short' });
  const labelFor = (bucket, i) => {
    if (i === buckets.length - 1) return daily ? t('d.today') : t('d.thisWeek');
    return shortMonthDay(daily ? bucket.from : bucket.to);
  };
  // Evenly spaced x labels, counted back from the newest bucket so "Today" is
  // always shown and no two labels crowd each other.
  const stepPx = buckets.length > 1 ? innerW / (buckets.length - 1) : innerW;
  const labelStep = Math.max(1, Math.ceil(76 / stepPx));
  const labelIndexes = [];
  for (let i = buckets.length - 1; i >= 0; i -= labelStep) labelIndexes.unshift(i);
  const tipFor = (p) =>
    t('d.trend.tip', {
      when: daily ? shortDate(p.from) : t('d.trend.range', { from: shortDate(p.from), to: shortDate(p.to) }),
      pct: percent(p.rate),
      n: p.recalled,
      total: p.total,
    });

  return (
    <div className="dash-line">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t(daily ? 'd.trend.aria.days' : 'd.trend.aria.weeks')}>
        {[0, 0.5, 1].map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} className="grid" />
            <text x={pad.left - 8} y={y(tick) + 4} textAnchor="end" className="axis">
              {t('d.n', { n: percent(tick) })}
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
            {t('d.n', { n: percent(last.rate) })}
          </text>
        )}
      </svg>
      <SrTable
        caption={t(daily ? 'd.trend.aria.days' : 'd.trend.aria.weeks')}
        head={[daily ? t('d.head.day') : t('d.head.week'), t('d.head.reviews'), t('d.head.recalled')]}
        rows={buckets.map((bucket) => [shortDate(bucket.to), bucket.total, bucket.rate === null ? '-' : percent(bucket.rate)])}
      />
    </div>
  );
}

function TrendToggle({ unit, onChange }) {
  const t = useDashT();

  return (
    <div className="seg-toggle" role="group" aria-label={t('d.trend.range.aria')}>
      {[
        ['days', t('d.trend.days')],
        ['weeks', t('d.trend.weeks')],
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
  const t = useDashT();

  return (
    <ul className="subject-bars">
      {subjects.map((subject) => {
        const share = subject.total > 0 ? subject.mastered / subject.total : 0;

        return (
          <li key={subject.name} style={{ '--subject': subjectAccent(subject.name) }}>
            <div className="subject-bar-head">
              <span className="subject-bar-name">
                <span className="subject-dot" aria-hidden="true" />
                {subject.name}
              </span>
              <span className="subject-bar-count">
                {t('d.subj.count', { n: subject.mastered, cards: t.n('d.card', subject.total) })}
              </span>
            </div>
            <div
              className="subject-track"
              role="img"
              aria-label={t('d.subj.aria', { name: subject.name, n: subject.mastered, total: subject.total })}
            >
              <div className="subject-fill" style={{ width: `${Math.max(share * 100, subject.mastered > 0 ? 4 : 0)}%` }} />
            </div>
            <p className="subject-bar-sub">
              {subject.rate !== null ? t('d.subj.rate', { pct: percent(subject.rate) }) : t('d.subj.none')}
              {subject.due > 0 ? t('d.subj.due', { n: subject.due }) : ''}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function Upcoming({ days }) {
  const t = useDashT();
  const shortDate = (date) => t.date(date);
  const max = Math.max(1, ...days.map((day) => day.count));

  return (
    <div className="dash-cols upcoming" role="group" aria-label={t('d.up.aria')}>
      {days.map((day) => {
        const tip = t('d.up.tip', { when: day.isToday ? t('d.today') : shortDate(day.date), cards: t.n('d.card', day.count) });

        return (
          <div className={day.isToday ? 'dash-col today' : 'dash-col'} key={day.key}>
            <span className="dash-col-total">{day.count > 0 ? t('d.n', { n: day.count }) : ''}</span>
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
              {day.isToday ? t('d.today') : t.date(day.date, { weekday: 'short' })}
            </span>
          </div>
        );
      })}
      <SrTable
        caption={t('d.up.caption')}
        head={[t('d.head.day'), t('d.head.due')]}
        rows={days.map((day) => [shortDate(day.date), day.count])}
      />
    </div>
  );
}

// The proof: each review of one card, with the real gap that came before it.
function JourneyStrip({ journey }) {
  const t = useDashT();
  const entries = journey.entries.slice(-8);

  return (
    <ol className="journey-strip">
      {entries.map((entry, i) => {
        const previous = entries[i - 1] || journey.entries[journey.entries.length - entries.length - 1];
        const gap = previous ? t.gap(entry.at - previous.at) : null;

        return (
          <li key={entry.id} className={entry.recalled ? 'hit' : 'miss'}>
            <span className="journey-gap">{gap ? t('d.journey.after', { gap }) : t('d.journey.first')}</span>
            <span className="journey-dot" aria-hidden="true" />
            <span className="journey-result">{entry.recalled ? t('d.journey.hit') : t('d.journey.miss')}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Moments({ data }) {
  const t = useDashT();
  const { best, toughest, longestMemoryCards, stats } = data;
  const tiles = [];

  if (best) {
    tiles.push(
      <article className="moment moment-feature" key="best" style={{ '--subject': subjectAccent(best.card.subject) }}>
        <p className="eyebrow">{t('d.m.best')}</p>
        <h4>&ldquo;{best.card.question}&rdquo;</h4>
        <p>{t('d.m.best.body', { n: best.streak, gap: t.gap(best.longestGap) })}</p>
        <JourneyStrip journey={best} />
      </article>
    );
  }

  if (longestMemoryCards.length > 0) {
    const top = longestMemoryCards[0];

    tiles.push(
      <article className="moment" key="long">
        <p className="eyebrow">{t('d.m.long')}</p>
        <h4>{t.days(top.reviewIntervalDays)}</h4>
        <p>{t('d.m.long.body', { q: top.question, span: t.days(top.reviewIntervalDays) })}</p>
      </article>
    );
  }

  if (stats.turnarounds > 0) {
    tiles.push(
      <article className="moment" key="comeback">
        <p className="eyebrow">{t('d.m.comeback')}</p>
        <h4>{t.n('d.card', stats.turnarounds)}</h4>
        <p>{t('d.m.comeback.body')}</p>
      </article>
    );
  } else if (stats.mastered > 0) {
    tiles.push(
      <article className="moment" key="mastered">
        <p className="eyebrow">{t('d.m.turned')}</p>
        <h4>{t('d.n', { n: stats.mastered })}</h4>
        <p>{t(stats.mastered === 1 ? 'd.m.turned.one' : 'd.m.turned.many')}</p>
      </article>
    );
  }

  if (toughest) {
    tiles.push(
      <article className="moment" key="tough">
        <p className="eyebrow">{t('d.m.tough')}</p>
        <h4>{t('d.m.tough.title', { n: toughest.totalMissed + toughest.streak })}</h4>
        <p>{t('d.m.tough.body', { q: toughest.card.question })}</p>
      </article>
    );
  }

  if (stats.bestDay && stats.bestDay.count >= 3) {
    tiles.push(
      <article className="moment" key="day">
        <p className="eyebrow">{t('d.m.day')}</p>
        <h4>{t.n('d.review', stats.bestDay.count)}</h4>
        <p>{t('d.m.day.body', { date: t.date(new Date(`${stats.bestDay.key}T00:00:00`)) })}</p>
      </article>
    );
  }

  if (tiles.length === 0) {
    return (
      <Empty>{t('d.m.empty')}</Empty>
    );
  }

  return <div className="moments">{tiles}</div>;
}

export function Badges({ badges }) {
  const t = useDashT();
  const earned = badges.filter((badge) => badge.earned).length;

  return (
    <>
      <p className="badge-count">
        {t('d.badges.count', { n: earned, total: badges.length })}
      </p>
      <ul className="badges">
        {badges.map((badge) => (
          <li key={badge.id} className={badge.earned ? 'badge earned' : 'badge'}>
            <span className="badge-mark" aria-hidden="true">
              {badge.earned ? '✓' : t('d.n', { n: `${badge.value}/${badge.goal}` })}
            </span>
            <span className="badge-text">
              <strong>{t(`badge.${badge.id}`, {}, badge.label)}</strong>
              <small>{t(`badge.${badge.id}.desc`, {}, badge.desc)}</small>
            </span>
            {badge.earned && <span className="sr-only">{t('d.badges.earned')}</span>}
          </li>
        ))}
      </ul>
    </>
  );
}

// details: inside the Memory map's "Details" (src/progress/MemoryMap.jsx):
// no hero and no streak number (the map shows the one streak).
export default function Dashboard({ cards, reviews, dueCount, showForm, onToggleAdd, onReview, details = false }) {
  const t = useDashT();
  const data = useMemo(() => computeAnalytics(cards, reviews, new Date(), { extraDays: streakTimes() }), [cards, reviews]);
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
      {!details && (
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
      )}

      {stats.totalCards > 0 && (
        <>
          <section className="dash-kpis" aria-label={t('d.kpis')}>
            {!details && (
            <Kpi
              label="Streak"
              value={stats.streak.current}
              unit={stats.streak.current === 1 ? ' day' : ' days'}
              sub={
                stats.streak.best > 0
                  ? `Best: ${t.n('d.day', stats.streak.best)}`
                  : 'Review today to start one'
              }
            />
            )}
            <Kpi
              label={t('d.k.reviews')}
              value={t('d.n', { n: stats.reviewsTotal })}
              sub={stats.reviewsTotal > 0 ? t('d.k.reviews.yes') : t('d.k.reviews.no')}
            />
            <Kpi
              label={t('d.k.rate')}
              value={stats.recallRate === null ? '-' : t('d.n', { n: percent(stats.recallRate) })}
              sub={stats.recallRate === null ? t('d.k.rate.no') : t('d.k.rate.yes', { n: stats.recalledCount, total: stats.historyCount })}
            />
            <Kpi
              label={t('d.k.span')}
              value={stats.longestIntervalDays > 0 ? t.days(stats.longestIntervalDays) : '-'}
              sub={stats.avgIntervalDays > 0 ? t('d.k.span.yes', { avg: t.days(stats.avgIntervalDays) }) : t('d.k.span.no')}
            />
            <Kpi
              label={t('d.k.for')}
              value={t('d.n', { n: stats.daysLearning })}
              unit={t(stats.daysLearning === 1 ? 'd.unit.day.one' : 'd.unit.day.many')}
              sub={t('d.k.saved', { cards: t.n('d.card', stats.totalCards) })}
            />
          </section>

          {stats.reviewsTotal > 0 && !stats.hasHistory && (
            <p className="dash-note">{t('d.note')}</p>
          )}

          <div className="dash-grid">
            <Panel title={t('d.p.stand')} note={t('d.p.stand.note')}>
              <StageRing stages={data.stages} total={Math.max(stats.totalCards, 1)} masteredPct={stats.masteredPct} />
            </Panel>

            <Panel
              title={t('d.p.14')}
              note={recentTotal > 0 ? t('d.p.14.note', { reviews: t.n('d.review', recentTotal) }) : t('d.bars.caption')}
            >
              {recentTotal > 0 ? (
                <>
                  <ActivityBars days={data.days} />
                  <p className="dash-legend" aria-hidden="true">
                    <span><i className="swatch hit" /> {t('d.head.recalled')}</span>
                    <span><i className="swatch miss" /> {t('d.head.missed')}</span>
                  </p>
                </>
              ) : (
                <Empty>{t('d.p.14.empty')}</Empty>
              )}
            </Panel>

            <Panel
              title={t('d.k.rate')}
              note={t(trendUnit === 'days' ? 'd.p.rate.note.days' : 'd.p.rate.note.weeks')}
              action={<TrendToggle unit={trendUnit} onChange={changeTrendUnit} />}
            >
              {hasTrend ? (
                <RecallTrend buckets={trendBuckets} unit={trendUnit} />
              ) : (
                <Empty>{t(trendUnit === 'days' ? 'd.p.rate.empty.days' : 'd.p.rate.empty.weeks')}</Empty>
              )}
            </Panel>

            <Panel title={t('d.p.subj')} note={t('d.p.subj.note')}>
              <SubjectBars subjects={data.subjects} />
            </Panel>

            <Panel title={t('d.p.up')} note={t('d.p.up.note')}>
              <Upcoming days={data.upcoming} />
            </Panel>

            <Panel title={t('d.p.proud')} note={t('d.p.proud.note')} wide>
              <Moments data={data} />
            </Panel>

            <Panel title={t('d.p.milestones')} wide>
              <Badges badges={data.badges} />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
