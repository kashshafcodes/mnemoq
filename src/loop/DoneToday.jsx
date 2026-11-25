import { useEffect, useState } from 'react';
import Jonaki from '../components/Jonaki';
import { loadReminderState, pushSupported } from '../reminders';
import { pageHref } from '../useRoute';
import { msUntilNext } from '../daily/calendar';
import { dayIndex, dueTomorrow, shortClock } from './playState';
import { useLoopT } from './strings';
import PlayButton from './PlayButton';
import RoundRing from './RoundRing';
import { stepLabelKey } from './useRound';
import { SESSION_SIZE } from '../quiz';
import './loop.css';

// "Done for today" (#/done): Jonaki rests, tomorrow's preview, and a quiet
// way to keep going. Opened by the Play button once nothing is left, and by
// "Done for today" at the end of a round or the Daily. If something is still
// waiting, it shows the Play button instead of claiming you are done.
// With Today's round: the full ring, any step left open ("Not now"), and a
// quiet "Another round?" only when cards are actually due.

const TITLES = 6;

export default function DoneToday({ cards, play, onPlay, userId, plan = null, dueCount = 0, onExtra = null }) {
  const t = useLoopT();
  const [left, setLeft] = useState(() => msUntilNext());
  const [remindersOff, setRemindersOff] = useState(false);
  const now = new Date();
  const tomorrow = dueTomorrow(cards, now);

  useEffect(() => {
    const id = setInterval(() => setLeft(msUntilNext()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!userId || !pushSupported()) return undefined;

    loadReminderState(userId)
      .then((state) => {
        if (!cancelled && !state.setup && !(state.settings.enabled && state.thisDevice)) setRemindersOff(true);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (play.kind !== 'done') {
    return (
      <section className="mq-done">
        <PlayButton state={play} onPlay={onPlay} floating={false} />
      </section>
    );
  }

  const time = shortClock(left);
  const open = plan ? plan.steps.filter((step) => step.skipped) : [];

  return (
    <section className="mq-done" aria-live="polite">
      {plan && plan.total > 0 ? <RoundRing plan={plan} size={156} /> : <Jonaki mood="sleep" glow={0.9} size={132} />}
      <h1>{open.length > 0 ? t('round.done.rest') : t(`done.title.${(dayIndex(now) % TITLES) + 1}`)}</h1>
      <p className="mq-done-tomorrow">{tomorrow > 0 ? t('done.tomorrow.cards', { n: tomorrow, time }) : t('done.tomorrow.daily', { time })}</p>
      {open.map((step) => (
        <p key={step.id} className="mq-round-note">
          {t('round.done.open', { step: t(stepLabelKey(step.id)) })}
        </p>
      ))}
      <div className="mq-done-actions">
        <a className="mq-btn mq-btn-primary mq-btn-lg" href={pageHref('today')}>
          {t('done.home')}
        </a>
        {dueCount > 0 && onExtra && (
          <button type="button" className="mq-done-link mq-done-extra" onClick={onExtra}>
            {t('round.done.extra', { size: Math.min(SESSION_SIZE, dueCount), n: dueCount })}
          </button>
        )}
        <a className="mq-done-link" href={pageHref('practice')}>
          {t('done.extra')}
        </a>
        {remindersOff && (
          <a className="mq-done-link" href={`${pageHref('me')}?reminders`}>
            {t('done.reminder')}
          </a>
        )}
      </div>
    </section>
  );
}
