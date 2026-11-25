import { useCallback, useEffect, useRef, useState } from 'react';
import Jonaki from '../components/Jonaki';
import { feel } from '../sensory';
import { sparks } from '../sensory/celebrate';
import { SITE } from '../shareCard';
import { supabase } from '../supabaseClient';
import { syncUser } from '../sync/queue';
import { track } from '../track';
import { callReferral } from './api';
import { hasCharm } from './charm';
import { inviteLink, useRefT } from './strings';
import './invite.css';

// The invite card (perks spec §3, §5.6): on Me and on the Pro page, not a tab.
// Your link carries your stored refcode (refcodes table, via api/referral.js),
// with Share and Copy, a line per friend on their way ("Rafi: 1 of 2 days"),
// the held state, and a celebration when new Pro days arrived from a friend.
//   where: 'me' | 'pro' (for the events)

const seenKey = (user) => `mnemoq-ref-granted-seen-${user || 'guest'}`;

function readSeen(user) {
  try {
    const n = localStorage.getItem(seenKey(user));

    return n === null ? null : Number(n) || 0;
  } catch {
    return null;
  }
}

function writeSeen(user, n) {
  try {
    localStorage.setItem(seenKey(user), String(n));
  } catch {
    // Storage blocked: the celebration may show again next time.
  }
}

export default function InviteCard({ where = 'me' }) {
  const t = useRefT();
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | error
  const [note, setNote] = useState(null); // { ok, text }
  const [earned, setEarned] = useState(false);
  const jonaki = useRef(null);
  const user = syncUser();

  const load = useCallback(async () => {
    setState('loading');

    const body = await callReferral(supabase, { action: 'invite' });

    if (!body?.refcode) {
      setState('error');
      return;
    }

    const before = readSeen(user);

    // New Pro days from a friend since the card was last open: celebrate once.
    if (before !== null && body.granted > before) {
      setEarned(true);
      feel('level.up');
    }

    writeSeen(user, body.granted || 0);
    setData(body);
    setState('ready');
  }, [user]);

  useEffect(() => {
    track('ref_invite_open', { how: where });
    load();
  }, [load, where]);

  useEffect(() => {
    if (earned && jonaki.current) sparks(jonaki.current, { hero: true });
  }, [earned]);

  const link = data?.refcode ? inviteLink(SITE, data.refcode) : '';

  async function copy(how = 'copy') {
    try {
      await navigator.clipboard.writeText(link);
      setNote({ ok: true, text: t('ref.invite.copied') });
      track('ref_invite_copy', { how });
      feel('tap.secondary');
    } catch {
      setNote({ ok: false, text: t('ref.invite.copyFail') });
    }
  }

  async function share() {
    feel('tap.primary');

    const text = t('ref.message.friend', { link });

    if (typeof navigator.share !== 'function') {
      await copy('share_fallback');
      return;
    }

    try {
      await navigator.share({ text });
      track('ref_invite_share', { how: 'share' });
      feel('glow.gain');
      setNote(null);
    } catch (err) {
      if (err?.name !== 'AbortError') await copy('share_fallback');
    }
  }

  return (
    <section className={`profile-card ref-invite ref-invite-${where}`} aria-labelledby={`ref-invite-${where}`}>
      <div className="ref-invite-head">
        <span className="ref-invite-jonaki" ref={jonaki}>
          <Jonaki mood={earned ? 'wow' : 'happy'} size={48} glow={earned ? 0.95 : 0.7} charm={hasCharm(user)} />
        </span>
        <h3 id={`ref-invite-${where}`}>{t('ref.invite.title')}</h3>
      </div>
      <p className="ref-invite-body">{t('ref.invite.body')}</p>

      {state === 'loading' && <p className="ref-invite-muted fx-skeleton">{t('ref.invite.loading')}</p>}

      {state === 'error' && (
        <p className="ref-invite-error" role="alert">
          {t('ref.invite.error')}{' '}
          <button type="button" className="mq-btn mq-btn-ghost" onClick={load}>
            {t('ref.invite.retry')}
          </button>
        </p>
      )}

      {state === 'ready' && (
        <>
          {earned && (
            <p className="ref-invite-earned fx-pop" role="status">
              {t('ref.earned.referrer')}
            </p>
          )}
          <input className="ref-invite-link" readOnly value={link} aria-label={t('ref.invite.copy')} onFocus={(e) => e.target.select()} />
          <div className="ref-invite-actions">
            <button type="button" className="mq-btn mq-btn-primary" onClick={share}>
              {t('ref.invite.share')}
            </button>
            <button type="button" className="mq-btn mq-btn-ghost" onClick={() => copy('copy')}>
              {t('ref.invite.copy')}
            </button>
          </div>
          {note && (
            <p className={note.ok ? 'ref-invite-muted' : 'ref-invite-error'} role="status">
              {note.text}
            </p>
          )}

          {(data.pending?.length > 0 || data.held > 0 || data.granted > 0 || data.cap) && (
            <ul className="ref-invite-list">
              {data.pending.map((p, i) => (
                <li key={`p${i}`}>{p.name ? t('ref.progress.named', { name: p.name, n: p.days }) : t('ref.progress.anon', { n: p.days })}</li>
              ))}
              {data.held > 0 && <li className="is-held">{t('ref.held')}</li>}
              {data.granted > 0 && <li className="is-done">{t('ref.invite.count', { n: data.granted })}</li>}
              {data.cap && <li>{t(data.cap === 'total' ? 'ref.cap.total' : 'ref.cap.month')}</li>}
            </ul>
          )}
        </>
      )}

      <p className="ref-invite-fine">{t('ref.invite.fine')}</p>
    </section>
  );
}
