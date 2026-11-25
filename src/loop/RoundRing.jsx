import Jonaki from '../components/Jonaki';
import { useLoopT } from './strings';
import './round.css';

// The progress ring of Today's round: one segment per step, filled only by
// real progress (cards fill card by card). A skipped step stays hollow.
// Always paired with a number and an aria label, never colour alone.

const R = 52;
const C = 2 * Math.PI * R;

function Arc({ start, length, className, width }) {
  return (
    <circle
      className={className}
      cx="60"
      cy="60"
      r={R}
      fill="none"
      strokeWidth={width}
      strokeLinecap="round"
      strokeDasharray={`${Math.max(0, length)} ${C}`}
      strokeDashoffset={-start}
      transform="rotate(-90 60 60)"
    />
  );
}

export default function RoundRing({ plan, size = 168, skeleton = false }) {
  const t = useLoopT();
  const steps = skeleton ? [{ id: 'a' }, { id: 'b' }] : plan.steps;
  const n = Math.max(1, steps.length);
  const gap = n > 1 ? 12 : 0;
  const slice = C / n;
  const seg = slice - gap;
  const left = skeleton ? 0 : plan.steps.filter((s) => !s.done && !s.skipped).length;
  const mood = skeleton ? 'idle' : plan.allDone ? 'sleep' : plan.doneCount > 0 ? 'happy' : 'idle';
  const glow = skeleton || plan.total === 0 ? 0.4 : 0.35 + 0.6 * (plan.doneCount / plan.total);
  const label = skeleton ? t('round.loading.aria') : t('round.ring.aria', { done: plan.doneCount, total: plan.total });

  return (
    <div className={`mq-ring${skeleton ? ' is-skeleton' : ''}${!skeleton && plan.allDone ? ' is-full' : ''}`} style={{ '--ring': `${size}px` }} role="img" aria-label={label}>
      <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
        {steps.map((step, i) => {
          const start = i * slice + gap / 2;

          if (step.skipped) {
            return (
              <g key={step.id}>
                <Arc className="mq-ring-hollow" start={start} length={seg} width={8} />
                <Arc className="mq-ring-hollow-in" start={start} length={seg} width={4.5} />
              </g>
            );
          }

          return (
            <g key={step.id}>
              <Arc className="mq-ring-track" start={start} length={seg} width={8} />
              {!skeleton && step.fill > 0 && <Arc className={`mq-ring-fill${step.done ? ' is-done' : ''}`} start={start} length={seg * step.fill} width={8} />}
            </g>
          );
        })}
      </svg>
      <div className="mq-ring-core">
        <Jonaki mood={mood} glow={glow} size={Math.round(size * 0.46)} />
        {!skeleton && (
          <small className="mq-ring-left">
            {plan.allDone
              ? plan.steps.some((s) => s.skipped)
                ? t('round.ring.count', { done: plan.doneCount, total: plan.total })
                : t('round.progress.done')
              : t('round.progress.left', { n: left })}
          </small>
        )}
      </div>
    </div>
  );
}
