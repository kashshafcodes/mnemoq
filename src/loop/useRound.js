import { useCallback, useEffect, useMemo, useState } from 'react';
import { dhakaDate } from '../daily/calendar';
import { dailyStatus } from '../daily/DailyTile';
import { haptic } from '../haptics';
import { track } from '../track';
import { cardsProgress, newRecord, playFromRound, roundPlan } from './roundPlan';
import { loadRound, pruneRounds, saveRound } from './roundStore';
import { drillSourceFor } from './drillSource';
import { dayIndex } from './playState';

// Today's round for the signed-in person: the plan, the Play button state and
// the few actions that change the day's record. The record lives on this
// device (roundStore.js); everything "done" is derived from real data.

export function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);

    window.addEventListener('online', on);
    window.addEventListener('offline', off);

    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return online;
}

const STEP_LABEL = { cards: 'round.step.cards', snap: 'round.step.snap', daily: 'round.step.daily', drill: 'round.step.drill' };

export const stepLabelKey = (id) => STEP_LABEL[id];

export function useRound({ userId, cards, dueCards, reviews, weakest, ready, pro = false, size = 10 }) {
  const online = useOnline();
  const today = dhakaDate();
  const [record, setRecord] = useState(() => loadRound(today, userId));
  const dailyPlayed = Boolean(dailyStatus().today);
  const drill = useMemo(() => drillSourceFor(weakest, { day: dayIndex(), pro }), [weakest, pro]);
  const dueIds = useMemo(() => dueCards.map((card) => String(card.id)), [dueCards]);

  // A new Dhaka day (or another account): a new round; yesterday's is ignored.
  const stale = record && (record.date !== today || (record.user && record.user !== userId));

  useEffect(() => {
    if (stale) setRecord(loadRound(today, userId));
  }, [stale, today, userId]);

  const live = stale ? null : record;
  const isToday = useCallback(
    (at) => {
      const when = new Date(at);

      return !Number.isNaN(when.getTime()) && dhakaDate(when) === today;
    },
    [today]
  );
  const progress = useMemo(
    () => ({ ...cardsProgress(live, reviews, dueIds, isToday), drillDone: Boolean(live?.drillDone) }),
    [live, reviews, dueIds, isToday]
  );

  const inputs = {
    dueCount: dueCards.length,
    hasCards: cards.length > 0,
    dailyPlayed,
    weakest,
    drillAvailable: Boolean(drill),
    online,
    size,
    record: live,
    progress,
  };
  const plan = roundPlan(inputs);
  // The plan at this moment, re-reading the Daily history (the Daily saves
  // its result before it hands back to the app).
  const planNow = () => roundPlan({ ...inputs, dailyPlayed: Boolean(dailyStatus().today) });

  // Write the day's record once the inputs are known (the path decides the drill).
  useEffect(() => {
    if (!userId || !ready || live) return;

    const fresh = newRecord(plan, { user: userId, dueIds, date: today });

    pruneRounds(today);
    setRecord(saveRound(fresh));
    track('round_open', {
      steps: fresh.steps.join(','),
      due: dueIds.length,
      size,
      daily_played: dailyPlayed,
      drill: fresh.steps.includes('drill'),
      online,
      first_of_day: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, ready, live, today]);

  // Steps that became done since we last looked: one tick each, and one
  // celebration the first time every step is finished (exactly once a day).
  const doneIds = plan.steps.filter((step) => step.done).map((step) => step.id).join(',');

  useEffect(() => {
    if (!live) return;

    const lit = new Set(live.lit || []);
    const newly = plan.steps.filter((step) => step.done && !lit.has(step.id));
    const celebrate = plan.allDone && plan.total > 0 && !live.celebrated && plan.doneCount > 0;

    if (newly.length === 0 && !celebrate) return;

    for (const step of newly) track('round_step_done', { step: step.id, n: step.target });

    if (celebrate) {
      haptic.celebrate();
      track('round_done', { steps_done: plan.doneCount, total: plan.total, skipped: plan.steps.filter((s) => s.skipped).length, extra_rounds: live.extra || 0 });
    } else {
      haptic.tap();
    }

    setRecord(saveRound({ ...live, lit: [...lit, ...newly.map((step) => step.id)], celebrated: live.celebrated || celebrate }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneIds, plan.allDone, live]);

  const update = useCallback(
    (change) => {
      setRecord((current) => {
        const base = current && current.date === today ? current : null;

        return base ? saveRound({ ...base, ...change(base) }) : base;
      });
    },
    [today]
  );

  const skip = useCallback(
    (id) => {
      track('round_step_skip', { step: id });
      update((rec) => ({ skipped: [...new Set([...(rec.skipped || []), id])] }));
    },
    [update]
  );

  const markDrillDone = useCallback(() => update(() => ({ drillDone: true })), [update]);

  const noteExtra = useCallback(() => {
    const next = (live?.extra || 0) + 1;

    track('round_extra', { n: dueIds.length, extra_rounds: next });
    update(() => ({ extra: next }));
  }, [update, live, dueIds.length]);

  const play = playFromRound(plan, { dueCount: dueCards.length, size, skill: drill?.skill || '' });

  return { plan, planNow, play, drill, online, skip, markDrillDone, noteExtra, record: live, loading: !live && !ready };
}
