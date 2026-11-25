import { SESSION_SIZE } from '../quiz';
import RoundRing from './RoundRing';
import { useLoopT } from './strings';
import { stepLabelKey } from './useRound';
import './round.css';

// Today's round on the Today tab: the ring, the steps in order, one line from
// Jonaki and an honest "Not now" for the current step. The Play button
// (rendered by App) starts the current step.

function stepSub(t, step, drill) {
  if (step.id === 'cards') return t('round.step.cards.sub', { n: step.target });
  if (step.id === 'drill') return t('round.step.drill.sub', { skill: drill?.skill || '' });

  return t(`round.step.${step.id}.sub`);
}

function jonakiLine(t, plan) {
  if (plan.allDone) return plan.steps.some((s) => s.skipped) ? t('round.done.rest') : t('round.jonaki.done');
  if (plan.doneCount === 0) return t('round.jonaki.start');
  if (plan.doneCount / plan.total >= 0.5) return t('round.jonaki.half');

  return t('round.step.done');
}

export default function TodayRound({ round, dueCount }) {
  const t = useLoopT();
  const { plan, drill, online, skip, loading } = round;

  if (loading) {
    return (
      <section className="mq-round" aria-busy="true">
        <RoundRing skeleton size={132} />
      </section>
    );
  }

  if (plan.total === 0) return null;

  return (
    <section className="mq-round" aria-labelledby="mq-round-title">
      <RoundRing plan={plan} size={132} />

      <div className="mq-round-body">
        <h2 id="mq-round-title">{t('round.title')}</h2>
        <p className="mq-round-line">{jonakiLine(t, plan)}</p>

        <ol className="mq-round-steps">
          {plan.steps.map((step) => {
            const state = step.done ? 'done' : step.skipped ? 'skipped' : plan.current === step.id ? 'current' : !step.enabled ? 'off' : 'next';

            return (
              <li key={step.id} className={`mq-round-step is-${state}`}>
                <span className="mq-round-dot" aria-hidden="true">
                  {step.done ? '✓' : ''}
                </span>
                <span className="mq-round-text">
                  <b>{t(stepLabelKey(step.id))}</b>
                  <small>
                    {step.skipped
                      ? t('round.skipped')
                      : !step.done && step.reason === 'offline'
                        ? t('round.offline.step')
                        : step.id === 'cards' && !step.done && step.n > 0
                          ? t('round.step.cards.progress', { n: step.n, target: step.target })
                          : stepSub(t, step, drill)}
                  </small>
                </span>
                {state === 'current' && (
                  <button type="button" className="mq-round-skip" onClick={() => skip(step.id)}>
                    {t('round.notNow')}
                  </button>
                )}
              </li>
            );
          })}
        </ol>

        {plan.many && <p className="mq-round-note">{t('round.many', { n: dueCount, size: SESSION_SIZE })}</p>}
        {plan.current === 'snap' && <p className="mq-round-note">{t('round.empty.new')}</p>}
        {plan.blocked && <p className="mq-round-note">{t('round.offline.none')}</p>}
        {!online && plan.current === 'daily' && <p className="mq-round-note">{t('round.offline.daily')}</p>}
      </div>
    </section>
  );
}
