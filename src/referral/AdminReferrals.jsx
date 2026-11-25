import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { callReferral } from './api';
import './invite.css';

// The owner's review on the Stats page: held and granted referrals with
// Release and Revoke, and link visits per refcode (utm_content, 30 days).
// The server checks site_admins on every call (api/referral.js); this list
// is only reachable from the admin page, but hiding it is not the guard.
// Owner-only text, English like the rest of AdminStats.

const REASONS = {
  burst: 'many sign-ups from one code in 24 h',
  shared_code: 'two accounts share this code',
  cap_month: 'referrer at the monthly cap (friend paid, referrer 0)',
  cap_total: 'referrer at the 10 cap (friend paid, referrer 0)',
  released: 'released by you',
  owner_revoked: 'revoked by you',
};

const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '');

export default function AdminReferrals() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    const body = await callReferral(supabase, { action: 'admin' });

    if (!body?.rows) setError('Referrals did not load (the server said no, or referrals-2.sql is not applied yet).');
    else {
      setError(null);
      setData(body);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action, row) {
    const label = action === 'release' ? 'Release (pays the friend and the referrer)' : 'Revoke (takes the days back)';

    if (!window.confirm(`${label} for ${row.friend || 'this friend'}?`)) return;

    setBusy(row.friend_id);

    const out = await callReferral(supabase, { action, friend: row.friend_id });

    setBusy(null);
    if (!out?.status || ['invalid', 'failed', 'missing'].includes(out.status)) setError(`${action} failed (${out?.status || 'no answer'}).`);
    await load();
  }

  return (
    <section className="st-card">
      <h2>Referrals</h2>
      <p className="st-muted">Held ones wait for you. Release pays both sides (the referrer gets 0 if over a cap); Revoke takes the days back.</p>
      {error && <p className="qa-message qa-error">{error}</p>}
      {!data && !error && <p className="st-muted">Loading…</p>}
      {data && (
        <>
          <div className="ref-admin-scroll">
          <table className="st-table">
            <thead>
              <tr>
                <th>Friend</th>
                <th>Referrer</th>
                <th>Status</th>
                <th>Days</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.friend_id}>
                  <td>
                    {r.friend || '—'} <small className="st-muted">{day(r.at)}</small>
                  </td>
                  <td>
                    {r.referrer || '—'} <small className="st-muted">{r.refcode}</small>
                  </td>
                  <td>
                    <span className={`ref-admin-status is-${r.status}`}>{r.status}</span>
                    {r.reason && <small className="st-muted"> {REASONS[r.reason] || r.reason}</small>}
                  </td>
                  <td>
                    {r.days_friend} / {r.days_referrer}
                  </td>
                  <td>
                    <div className="ref-admin-actions">
                      {r.status === 'held' && (
                        <button type="button" className="mq-btn mq-btn-primary" disabled={busy === r.friend_id} onClick={() => act('release', r)}>
                          Release
                        </button>
                      )}
                      {(r.status === 'held' || r.status === 'granted') && (
                        <button type="button" className="mq-btn mq-btn-ghost" disabled={busy === r.friend_id} onClick={() => act('revoke', r)}>
                          Revoke
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {data.rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="st-muted">
                    No referrals yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>

          <h3>Link visits per person (30 days)</h3>
          <div className="ref-admin-scroll">
          <table className="st-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Owner</th>
                <th>Visitors</th>
              </tr>
            </thead>
            <tbody>
              {data.visits.map((v) => (
                <tr key={v.refcode}>
                  <td>{v.refcode}</td>
                  <td>{v.owner || '—'}</td>
                  <td>{v.visitors}</td>
                </tr>
              ))}
              {data.visits.length === 0 && (
                <tr>
                  <td colSpan={3} className="st-muted">
                    No visits from friends' links yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </>
      )}
    </section>
  );
}
