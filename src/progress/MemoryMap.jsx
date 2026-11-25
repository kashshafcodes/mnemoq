import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Jonaki from '../components/Jonaki';
import { jonakiGlow } from '../glow/glow';
import { useGlow } from '../glow/store';
import { useOnline } from '../loop/useRound';
import { feel } from '../sensory';
import { streakTimes } from '../streak/activity';
import { track } from '../track';
import { grownNodes, memoryMapData, snapshot } from './mapData';
import { useMapT } from './strings';
import './map.css';

// The old dashboard panels, opened from "Details" only.
const Dashboard = lazy(() => import('../components/Dashboard'));

// Progress = the Memory map (spec phase2-glow-memory-map §4, §5): one
// scrolling screen, one action per block. Readiness first, then the streak,
// kept cards, skills, and Details (the old panels, collapsed).
const SEEN_KEY = 'mnemoq-map-seen-';

function readSeen(userId) {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY + userId) || 'null');
  } catch {
    return null;
  }
}

function writeSeen(userId, value) {
  try {
    localStorage.setItem(SEEN_KEY + userId, JSON.stringify(value));
  } catch {
    // Pulses are a nicety.
  }
}

function Skeleton() {
  return (
    <div className="mm" aria-busy="true">
      {[72, 120, 96, 80, 120].map((h, i) => (
        <div key={i} className="mm-block mm-skel fx-skeleton" style={{ height: h }} />
      ))}
    </div>
  );
}

function StreakStrip({ streak }) {
  return (
    <ol className="mm-strip" aria-hidden="true">
      {streak.days.map((d) => (
        <li key={d.day} className={`mm-dot is-${d.state}`} />
      ))}
    </ol>
  );
}

export default function MemoryMap({
  cards,
  reviews,
  dueCount = 0,
  pathInfo,
  historyOk = true,
  loading = false,
  userId = 'guest',
  onPlay,
  onPickExam,
  onTakeCheck,
  onDrill,
  onLibrary,
  onRetry,
  onReview,
  onAdd,
}) {
  const t = useMapT();
  const online = useOnline();
  const { total: glowTotal, version } = useGlow();
  const data = useMemo(
    () => memoryMapData({ cards, reviews, extraDays: streakTimes(), pathInfo, glowTotal, historyOk }),
    // version: re-read the streak after any Glow award (a new learning day).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cards, reviews, pathInfo, glowTotal, historyOk, version]
  );
  const [pulse, setPulse] = useState([]);
  const nodes = useRef({});
  const viewed = useRef(false);

  // memory_map_view once per visit, and one soft pulse on each block that grew
  // since the last visit (no sound for just opening the tab, unless it grew).
  useEffect(() => {
    if (loading) return;

    if (!viewed.current) {
      viewed.current = true;
      track('memory_map_view', {
        has_path: Boolean(pathInfo),
        has_diagnostic: Boolean(pathInfo?.hasDiagnostic),
        streak: data.streak?.current ?? null,
        level: data.glow?.level ?? null,
      });
    }

    if (!historyOk) return;

    const grown = grownNodes(readSeen(userId), data);

    writeSeen(userId, snapshot(data));
    if (grown.length === 0) return;
    setPulse(grown);

    const first = grown[0];
    feel(first === 'streak' ? 'streak.kept' : 'glow.gain', { el: nodes.current[first] });
  }, [loading, historyOk, userId, data, pathInfo]);

  if (loading) return <Skeleton />;

  const { glow, ready, streak, kept, skills, empty } = data;
  const level = glow?.level ?? 1;
  const toward = glow && glow.next !== null ? Math.min(1, (glow.total - glow.from) / (glow.next - glow.from)) : 1;
  const yesterday = streak?.days?.[streak.days.length - 2];
  const jonakiLine = empty
    ? t('feel.map.empty')
    : !streak
      ? ''
      : streak.reviewedToday
        ? t('feel.map.lit')
        : streak.atRisk
          ? t('feel.map.atRisk')
          : yesterday?.state === 'rest' && streak.current > 0
            ? t('feel.map.rest')
            : t('feel.map.idle');
  const cls = (name) => `mm-block${pulse.includes(name) ? ' fx-pulse-once' : ''}`;
  const ref = (name) => (el) => {
    nodes.current[name] = el;
  };

  function readyCta(action, run) {
    track('readiness_cta', { action });
    feel('tap.primary');
    run?.();
  }

  return (
    <div className="mm fx-list">
      <section className={`${cls('glow')} mm-head`} ref={ref('glow')} aria-label={t('mm.title')}>
        <Jonaki mood={empty ? 'idle' : streak?.reviewedToday ? 'happy' : 'idle'} glow={jonakiGlow(glow?.total ?? 0)} size={64} />
        <div className="mm-head-text">
          <p className="mm-eyebrow">
            {t('mm.title')}
            {!online && <span className="mm-badge">{t('offline.short')}</span>}
          </p>
          {glow ? (
            <>
              <h2>
                {t(`glow.level.${level}`)} <span>· {t('glow.label')} {t('mm.n', { n: glow.total })}</span>
              </h2>
              <div className="mm-bar" role="img" aria-label={glow.next !== null ? t('glow.next', { n: glow.toNext, level: t(`glow.level.${level + 1}`) }) : t(`glow.level.${level}`)}>
                <i className="fx-grow-x" style={{ width: `${Math.max(toward * 100, 2)}%` }} />
              </div>
              <p className="mm-sub">{glow.next !== null ? t('glow.next', { n: glow.toNext, level: t(`glow.level.${level + 1}`) }) : t('glow.promise')}</p>
            </>
          ) : (
            <h2>—</h2>
          )}
          {jonakiLine && <p className="mm-jonaki">{jonakiLine}</p>}
        </div>
      </section>

      {empty && (
        <section className="mm-block mm-empty fx-empty">
          <h3>{t('empty.progress.title')}</h3>
          <p>{t('empty.progress.body')}</p>
          <button type="button" onClick={() => { feel('tap.primary'); onPlay?.(); }}>{t('mm.play')}</button>
        </section>
      )}

      <section className="mm-block" aria-label={t('mm.ready.title')}>
        <h3>{t('mm.ready.title')}</h3>
        {ready.kind === 'noPath' && (
          <>
            <p>{t('mm.ready.noPath')}</p>
            {!empty && <button type="button" className="ghost-button" onClick={() => readyCta('pick_exam', onPickExam)}>{t('mm.ready.pick')}</button>}
          </>
        )}
        {ready.kind === 'noCheck' && (
          <>
            <p>{t('mm.ready.noCheck')}</p>
            <button type="button" className="ghost-button" onClick={() => readyCta('take_check', onTakeCheck)}>{t('mm.ready.check')}</button>
          </>
        )}
        {ready.kind === 'score' && (
          <>
            <p className="mm-big">
              {ready.name} <b>{t('mm.ready.score', { score: ready.score, target: ready.target })}</b>
            </p>
            <p className="mm-sub">
              {t(`mm.band.${ready.band}`)}
              {ready.daysLeft !== null && ready.daysLeft !== undefined && ready.daysLeft >= 0 && ` · ${t('mm.ready.days', { n: ready.daysLeft })}`}
            </p>
            {ready.weakest && (
              <div className="mm-row">
                <span>{t('mm.ready.weakest', { skill: ready.weakest.name })}</span>
                <button type="button" className="ghost-button" onClick={() => readyCta('drill', () => onDrill?.(ready.weakest))}>{t('mm.ready.drill', { skill: ready.weakest.name })}</button>
              </div>
            )}
            <p className="mm-fine">{t('mm.ready.estimate')}</p>
          </>
        )}
      </section>

      <section className={cls('streak')} ref={ref('streak')} aria-label={t('streak.label')}>
        {streak ? (
          <>
            <div className="mm-row">
              <h3 aria-label={t('streak.aria', { n: streak.current, best: streak.best, rest: streak.restUsed })}>
                <b className="mm-num">{t('mm.n', { n: streak.current })}</b> {t('streak.label')}
              </h3>
              <span className="mm-sub">{t('streak.best', { n: streak.best })}</span>
            </div>
            <StreakStrip streak={streak} />
            {streak.best === 0 ? (
              <p className="mm-sub">{t('mm.empty.streak')}</p>
            ) : (
              <p className="mm-sub" title={t('streak.how')}>{t('streak.rest.line', { n: streak.restUsed })}</p>
            )}
            {streak.atRisk && <p className="mm-note">{t('streak.atRisk')}</p>}
          </>
        ) : (
          <>
            <div className="mm-row">
              <h3><b className="mm-num">—</b> {t('streak.label')}</h3>
            </div>
            <p className="mm-sub">{t('mm.err.history')}</p>
            <button type="button" className="ghost-button" onClick={onRetry}>{t('mm.retry')}</button>
          </>
        )}
      </section>

      <section className={cls('kept')} ref={ref('kept')}>
        <button
          type="button"
          className="mm-tap"
          onClick={() => {
            track('kept_tap');
            feel('tap.secondary');
            onLibrary?.();
          }}
        >
          <span className="mm-row">
            <h3>{t('mm.kept.title')}</h3>
            <span className="mm-big">{t('mm.kept.of', { n: kept.n, total: kept.total })}</span>
          </span>
          {kept.total > 0 && (
            <span className="mm-stages" role="img" aria-label={kept.stages.map((s) => `${t(`mm.stage.${s.id}`)} ${s.count}`).join(', ')}>
              {kept.stages.filter((s) => s.count > 0).map((s) => (
                <i key={s.id} className={`fx-grow-x is-${s.id}`} style={{ flexGrow: s.count }} />
              ))}
            </span>
          )}
          <span className="mm-legend" aria-hidden="true">
            {kept.stages.map((s) => (
              <span key={s.id}><i className={`is-${s.id}`} /> {t(`mm.stage.${s.id}`)}</span>
            ))}
          </span>
          <span className="mm-fine">{t('mm.kept.hint')}</span>
        </button>
      </section>

      {skills.length > 0 && (
        <section className="mm-block" aria-label={t('mm.skills.title')}>
          <h3>{t('mm.skills.title')}</h3>
          <ul className="mm-skills">
            {skills.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="mm-tap mm-skill"
                  onClick={() => {
                    track('skill_tap', { skill: s.name });
                    feel('tap.secondary');
                    onDrill?.(s);
                  }}
                >
                  <span className="mm-skill-name">{s.name}</span>
                  {s.score === null ? (
                    <span className="mm-fine">{t('mm.skills.notEnough')}</span>
                  ) : (
                    <>
                      <span className="mm-skill-bar"><i className="fx-grow-x" style={{ width: `${Math.max(3, (s.score / s.max) * 100)}%` }} /></span>
                      <b>{t('mm.n', { n: s.score })}</b>
                    </>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!empty && (
        <details className="mm-block mm-details">
          <summary>{t('mm.details')}</summary>
          <Suspense fallback={<div className="mm-skel fx-skeleton" style={{ height: 160 }} />}>
            <Dashboard cards={cards} reviews={reviews} dueCount={dueCount} showForm={false} onToggleAdd={onAdd} onReview={onReview} details />
          </Suspense>
        </details>
      )}
    </div>
  );
}
