import { useEffect, useRef, useState } from 'react';
import Jonaki from '../components/Jonaki';
import { feel } from '../sensory';
import { pickReward, sparks } from '../sensory/celebrate';
import { track } from '../track';
import { trackEvent } from '../googleAnalytics';
import { knownSeen, mergeSeen, queueSeen, syncUser } from '../sync/queue';
import { dhakaKey } from './streak';
import { dueCelebrations, milestoneId } from './milestones';
import { ledgerSeen, saveLedgerSeen, takeCapNotice, useGlow } from './store';
import { useGlowT } from './strings';
import { knownFriends, takeFriendNotice } from '../referral/friends';
import './glow.css';

// Milestones, level-ups and the calm cap line, app-wide (mounted once in
// App.jsx while signed in). A banner for 3 s that never blocks taps.
// Each milestone and level fires once per account, ever: what was shown is
// kept on the device and in learner_profile (milestones_seen, glow_level_seen),
// and a signed-in device waits for the account's list before celebrating.
// Also sends the streak events that need memory of yesterday
// (streak_rest_used, streak_ended).

const SHOW_MS = 3000;
const STREAK_KEY = 'mnemoq-streak-seen';

function readStreakMemo(user) {
  try {
    const saved = JSON.parse(localStorage.getItem(STREAK_KEY) || 'null');

    return saved && saved.user === user ? saved : { user };
  } catch {
    return { user };
  }
}

function writeStreakMemo(memo) {
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(memo));
  } catch {
    // Blocked storage: an event may repeat, nothing else.
  }
}

// streak_rest_used once per Dhaka day when yesterday closed as a rest day;
// streak_ended when the chain we saw last time has broken.
function streakEvents(streak, user) {
  const memo = readStreakMemo(user);
  const today = dhakaKey(new Date());
  const yesterday = streak.days?.[streak.days.length - 2];

  if (yesterday?.state === 'rest' && memo.restDay !== today) {
    track('streak_rest_used', { rest_used: streak.restUsed });
    trackEvent('streak_rest_used', { rest_used: streak.restUsed });
    memo.restDay = today;
  }

  // A broken chain restarts at 0 (or 1, if today is already lit); a smaller
  // number for any other reason (history still loading elsewhere) is not an end.
  if (Number(memo.last) > 1 && streak.current < memo.last && streak.current <= 1) {
    track('streak_ended', { length: memo.last, best: streak.best });
    trackEvent('streak_ended', { length: memo.last, best: streak.best });
  }

  memo.last = streak.current;
  writeStreakMemo(memo);
}

export default function Celebrations({ streak, ready }) {
  const t = useGlowT();
  const { total, version } = useGlow();
  const [banner, setBanner] = useState(null);
  const ref = useRef(null);
  const user = syncUser();

  useEffect(() => {
    if (ready && streak) streakEvents(streak, user);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, streak?.current, streak?.restUsed, user]);

  useEffect(() => {
    if (!ready || !streak) return;

    const account = knownSeen();

    if (user && !account.pulled) return; // the account's list has not arrived

    const seen = mergeSeen(account.seen, ledgerSeen());
    const due = dueCelebrations({ streak: streak.current, glow: total, seen, friends: user ? knownFriends(user)?.friends || 0 : 0 });
    const friendGlow = takeFriendNotice();

    if (friendGlow) {
      track('glow_earned', { source: 'friend', glow: friendGlow * 5 });
      trackEvent('glow_earned', { source: 'friend' });
    }

    if (!due.milestone && !due.levelUp && !due.charm) {
      if (friendGlow) {
        feel('glow.gain');
        setBanner({ calm: false, lines: [t('perk.friend.opened')], key: Date.now() });
      } else if (takeCapNotice()) setBanner({ calm: true, lines: [t('glow.capped')], key: Date.now() });
      return;
    }

    saveLedgerSeen(due.seen);
    queueSeen(due.seen);

    const lines = [];
    const ids = [];

    if (due.milestone) {
      lines.push(t(milestoneId(due.milestone)));
      ids.push('milestone');
      track('streak_milestone', { days: due.milestone });
      trackEvent('streak_milestone', { days: due.milestone });
    }

    if (due.levelUp) {
      lines.push(t('glow.levelUp', { level: t(`glow.level.${due.levelUp}`) }));
      ids.push('level.up');
      track('glow_level_up', { level: due.levelUp });
      trackEvent('glow_level_up', { level: due.levelUp });
    }

    if (due.charm) {
      lines.push(t('perk.charm.earned'));
      ids.push('milestone');
      track('charm_earned', { charm: 'light_passer' });
      trackEvent('charm_earned', { charm: 'light_passer' });
    }

    if (friendGlow) lines.push(t('perk.friend.opened'));

    // A milestone and a level-up on the same action: one celebration, both lines.
    feel(pickReward(ids));
    setBanner({ calm: false, lines, key: Date.now() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, streak?.current, total, version, user]);

  useEffect(() => {
    if (!banner) return undefined;
    if (!banner.calm && ref.current) sparks(ref.current, { hero: true });

    const timer = setTimeout(() => setBanner(null), SHOW_MS);

    return () => clearTimeout(timer);
  }, [banner]);

  if (!banner) return null;

  return (
    <div className={`mq-glow-banner${banner.calm ? ' is-calm' : ''}`} role="status" aria-live="polite" key={banner.key}>
      <span className="mq-glow-banner-jonaki" ref={ref}>
        <Jonaki mood={banner.calm ? 'sleep' : 'wow'} size={44} glow={banner.calm ? 1 : 0.9} />
      </span>
      <span className="mq-glow-banner-text">
        {banner.lines.map((line) => (
          <b key={line}>{line}</b>
        ))}
      </span>
    </div>
  );
}
