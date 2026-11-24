import { useEffect, useState } from 'react';
import Jonaki from '../components/Jonaki';
import { loadReminderState, pushSupported } from '../reminders';
import { pageHref } from '../useRoute';
import { msUntilNext } from '../daily/calendar';
import { dayIndex, dueTomorrow, shortClock } from './playState';
import { useLoopT } from './strings';
import PlayButton from './PlayButton';
import './loop.css';

// "Done for today" (#/done): Jonaki rests, tomorrow's preview, and a quiet
// way to keep going. Opened by the Play button once nothing is left, and by
// "Done for today" at the end of a round or the Daily. If something is still
// waiting, it shows the Play button instead of claiming you are done.

const TITLES = 6;

export default function DoneToday({ cards, play, onPlay, userId }) {
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

  return (
    <section className="mq-done" aria-live="polite">
      <Jonaki mood="sleep" glow={0.9} size={132} />
      <h1>{t(`done.title.${(dayIndex(now) % TITLES) + 1}`)}</h1>
      <p className="mq-done-tomorrow">{tomorrow > 0 ? t('done.tomorrow.cards', { n: tomorrow, time }) : t('done.tomorrow.daily', { time })}</p>
      <div className="mq-done-actions">
        <a className="mq-btn mq-btn-primary mq-btn-lg" href={pageHref('home')}>
          {t('done.home')}
        </a>
        <a className="mq-done-link" href={pageHref('practice')}>
          {t('done.extra')}
        </a>
        {remindersOff && (
          <a className="mq-done-link" href={`${pageHref('profile')}?reminders`}>
            {t('done.reminder')}
          </a>
        )}
      </div>
    </section>
  );
}
