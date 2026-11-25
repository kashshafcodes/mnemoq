import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { mergePages, pageNameNow } from '../nav/routes';

// The owner's Stats page (#/admin): who is landing on the site, where they came
// from, what they do, and whether reminders are running. Data comes from
// supabase/analytics.sql; only accounts listed in site_admins can load it.

const PERIODS = [
  [1, 'Today'],
  [7, '7 days'],
  [30, '30 days'],
  [90, '90 days'],
];

const SITE = typeof window !== 'undefined' ? window.location.origin : 'https://mnemoq-two.vercel.app';

const EVENT_LABELS = {
  landing_view: 'Landed on the site',
  page_view: 'Opened a page',
  cta_click: 'Clicked a sign-up button',
  signup_open: 'Opened sign up',
  sign_up: 'Created an account',
  login: 'Logged in',
  mistake_saved: 'Saved a card',
  first_mistake_saved: 'Saved their first card',
  review_completed: 'Reviewed a card',
  ai_generation: 'Used AI',
  path_saved: 'Chose an exam path',
  diagnostic_done: 'Finished a diagnostic',
  mock_done: 'Finished a mock test',
  pilot_done: 'Finished the exam debrief',
  pro_redeemed: 'Became Pro',
  guest_diag_start: 'Started a free diagnostic',
  guest_diag_done: 'Finished a free diagnostic',
  reminders_on: 'Turned on reminders',
};

const n = (value) => Number(value || 0).toLocaleString();
const pct = (part, whole) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '–');

function ago(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);

  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;

  return `${Math.floor(s / 86400)} d ago`;
}

function Kpi({ label, value, hint }) {
  return (
    <div className="st-kpi">
      <p>{label}</p>
      <b>{value}</b>
      {hint && <small>{hint}</small>}
    </div>
  );
}

function DailyChart({ days }) {
  const max = Math.max(1, ...days.map((d) => d.visitors));

  if (days.length === 0) return null;

  return (
    <div className="st-chart" role="img" aria-label="Visitors and sign-ups per day">
      {days.map((d) => (
        <div key={d.day} className="st-bar-col" title={`${d.day}: ${d.visitors} visitors, ${d.signups} sign-ups, ${d.active} active`}>
          <div className="st-bar-stack">
            <span className="st-bar" style={{ height: `${(d.visitors / max) * 100}%` }} />
            <span className="st-bar st-bar-signup" style={{ height: `${(d.signups / max) * 100}%` }} />
          </div>
          {days.length <= 31 && <small>{new Date(`${d.day}T12:00:00`).getDate()}</small>}
        </div>
      ))}
    </div>
  );
}

function LinkBuilder() {
  const [source, setSource] = useState('facebook');
  const [campaign, setCampaign] = useState('');
  const [copied, setCopied] = useState(false);
  const slug = (v) => v.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const url = `${SITE}/?utm_source=${slug(source) || 'social'}${campaign.trim() ? `&utm_campaign=${slug(campaign)}` : ''}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="st-card">
      <h2>Link for a post</h2>
      <p className="st-muted">Use a different link in each post. The tables above then show which post brought visitors, sign-ups and Pro.</p>
      <div className="st-builder">
        <label>
          Where you post it
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            {['facebook', 'instagram', 'whatsapp', 'messenger', 'youtube', 'tiktok', 'linkedin', 'x', 'reddit', 'email', 'poster'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Name of the post or group (optional)
          <input value={campaign} onChange={(e) => setCampaign(e.target.value)} placeholder="sat-group-nov" maxLength={40} />
        </label>
      </div>
      <div className="st-link">
        <code>{url}</code>
        <button type="button" className="mq-btn mq-btn-primary" onClick={copy}>
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
    </section>
  );
}

export default function AdminStats() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [recent, setRecent] = useState([]);
  const [users, setUsers] = useState([]);
  const [health, setHealth] = useState(null);
  const [payments, setPayments] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('live');

  const load = useCallback(async () => {
    const [overview, feed, people, reminders, paid] = await Promise.all([
      supabase.rpc('admin_overview', { p_days: days }),
      supabase.rpc('admin_recent', { p_limit: 80 }),
      supabase.rpc('admin_users', { p_limit: 500 }),
      supabase.rpc('admin_reminder_health'),
      supabase.rpc('admin_payments', { p_limit: 50 }),
    ]);

    if (overview.error) {
      setError(
        /function|schema cache|does not exist|PGRST202/i.test(overview.error.message || '')
          ? 'setup'
          : overview.error.message || 'Could not load stats.'
      );
      return;
    }

    setError('');
    // Page names changed with the five tabs (home -> today, path -> exam, ...).
    setData(overview.data ? { ...overview.data, pages: mergePages(overview.data.pages) } : overview.data);
    setRecent(feed.data || []);
    setUsers(people.data || []);
    setHealth(reminders.data || null);
    setPayments(paid.error ? null : paid.data || []);
  }, [days]);

  useEffect(() => {
    load();

    const timer = setInterval(load, 30000);

    return () => clearInterval(timer);
  }, [load]);

  const shownUsers = useMemo(() => {
    const q = query.trim().toLowerCase();

    return q ? users.filter((u) => `${u.email} ${u.source || ''}`.toLowerCase().includes(q)) : users;
  }, [users, query]);

  if (error === 'setup') {
    return (
      <div className="st">
        <header className="mq-page-head">
          <h1>Stats</h1>
        </header>
        <section className="st-card">
          <h2>One-time setup</h2>
          <p>Run <code>supabase/analytics.sql</code> in Supabase &gt; SQL Editor, then add yourself as an admin:</p>
          <pre>insert into public.site_admins (email) values ('your-login-email') on conflict do nothing;</pre>
        </section>
      </div>
    );
  }

  const k = data?.kpis || {};
  const funnel = data?.funnel || [];
  const top = funnel[0]?.count || 0;
  const lastRun = health?.last_runs?.[0];
  const runFresh = lastRun && Date.now() - new Date(lastRun.ran_at).getTime() < 40 * 60 * 1000;

  return (
    <div className="st">
      <header className="mq-page-head st-head">
        <div>
          <h1>Stats</h1>
          <p className="st-muted">Updates every 30 seconds. Only you can see this page.</p>
        </div>
        <div className="mq-seg" role="tablist" aria-label="Period">
          {PERIODS.map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={days === value} className={days === value ? 'active' : ''} onClick={() => setDays(value)}>
              {label}
            </button>
          ))}
        </div>
      </header>

      {error && <p className="qa-message qa-error">{error}</p>}
      {!data && !error && <p className="st-muted">Loading…</p>}

      {data && (
        <>
          <div className="st-kpis">
            <Kpi label="Visitors" value={n(k.visitors)} hint={`${n(k.sessions)} visits`} />
            <Kpi label="New accounts" value={n(k.signups)} hint={`${pct(k.signups, k.visitors)} of visitors`} />
            <Kpi label="Active users" value={n(k.active_users)} hint={`${n(k.total_users)} accounts in total`} />
            <Kpi label="Reviews done" value={n(k.reviews)} hint={`${n(k.cards_added)} cards added`} />
            <Kpi label="Pro now" value={n(k.pro_now)} />
            <Kpi
              label={`Errors (${days === 1 ? 'today' : `${days} days`})`}
              value={n((data.events || []).find((e) => e.event === 'client_error')?.n || 0)}
              hint="client_error events, max 5 per page load"
            />
          </div>

          <section className="st-card">
            <div className="st-card-head">
              <h2>Every day</h2>
              <p className="st-legend">
                <span className="st-dot" /> visitors <span className="st-dot st-dot-signup" /> new accounts
              </p>
            </div>
            <DailyChart days={data.daily || []} />
          </section>

          <div className="st-two">
            <section className="st-card">
              <h2>From visit to paying</h2>
              <ol className="st-funnel">
                {funnel.map((step, i) => (
                  <li key={step.step}>
                    <div className="st-funnel-text">
                      <span>{step.step}</span>
                      <b>{n(step.count)}</b>
                      {i > 0 && <small>{pct(step.count, funnel[i - 1].count)} of previous</small>}
                    </div>
                    <span className="st-funnel-bar" style={{ width: top ? `${Math.max(2, (step.count / top) * 100)}%` : '2%' }} />
                  </li>
                ))}
              </ol>
            </section>

            <section className="st-card">
              <h2>Where they came from</h2>
              <table className="st-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Visitors</th>
                    <th>Accounts</th>
                    <th>Rate</th>
                    <th>Pro</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.sources || []).map((s) => (
                    <tr key={s.source}>
                      <td>{s.source}</td>
                      <td>{n(s.visitors)}</td>
                      <td>{n(s.signups)}</td>
                      <td>{pct(s.signups, s.visitors)}</td>
                      <td>{n(s.pro)}</td>
                    </tr>
                  ))}
                  {(data.sources || []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="st-muted">No visits yet in this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              {(data.campaigns || []).length > 0 && (
                <>
                  <h3>Posts and campaigns</h3>
                  <table className="st-table">
                    <tbody>
                      {data.campaigns.map((c) => (
                        <tr key={`${c.source}-${c.campaign}`}>
                          <td>
                            {c.campaign} <small className="st-muted">{c.source}</small>
                          </td>
                          <td>{n(c.visitors)} visitors</td>
                          <td>{n(c.signups)} accounts</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </section>
          </div>

          <LinkBuilder />

          <section className="st-card">
            <div className="st-card-head">
              <div className="mq-seg" role="tablist">
                {[
                  ['live', 'Live activity'],
                  ['users', `Users (${users.length})`],
                  ['more', 'Pages and devices'],
                ].map(([id, label]) => (
                  <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
                    {label}
                  </button>
                ))}
              </div>
              {tab === 'users' && <input className="st-search" placeholder="Search email or source" value={query} onChange={(e) => setQuery(e.target.value)} />}
            </div>

            {tab === 'live' && (
              <ul className="st-feed">
                {recent.map((e, i) => (
                  <li key={`${e.at}-${i}`}>
                    <time>{ago(e.at)}</time>
                    <span>
                      <b>{e.email || `Visitor ${e.visitor}`}</b> {(EVENT_LABELS[e.event] || e.event).toLowerCase()}
                      {e.event === 'page_view' && e.page ? `: ${pageNameNow(e.page)}` : ''}
                    </span>
                    <small>
                      {e.source || 'direct'} · {e.device || '?'}
                    </small>
                  </li>
                ))}
                {recent.length === 0 && <li className="st-muted">Nothing yet. Open the site in a private window to see your own visit appear.</li>}
              </ul>
            )}

            {tab === 'users' && (
              <div className="st-scroll">
                <table className="st-table">
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Joined</th>
                      <th>Came from</th>
                      <th>Cards</th>
                      <th>Reviews</th>
                      <th>Days active</th>
                      <th>Last seen</th>
                      <th>Plan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownUsers.map((u) => (
                      <tr key={u.email}>
                        <td>{u.email}</td>
                        <td>{new Date(u.joined).toLocaleDateString()}</td>
                        <td>{u.source || '–'}</td>
                        <td>{n(u.cards)}</td>
                        <td>{n(u.reviews)}</td>
                        <td>{n(u.active_days)}</td>
                        <td>{u.last_seen ? ago(u.last_seen) : '–'}</td>
                        <td>{u.pro_until && new Date(u.pro_until) > new Date() ? <span className="st-pill">Pro</span> : 'Free'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tab === 'more' && (
              <div className="st-two">
                <table className="st-table">
                  <thead>
                    <tr>
                      <th>Page</th>
                      <th>Views</th>
                      <th>Visitors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.pages || []).map((p) => (
                      <tr key={p.page}>
                        <td>{p.page}</td>
                        <td>{n(p.views)}</td>
                        <td>{n(p.visitors)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <table className="st-table">
                  <thead>
                    <tr>
                      <th>Device</th>
                      <th>Visitors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.devices || {}).map(([d, count]) => (
                      <tr key={d}>
                        <td>{d}</td>
                        <td>{n(count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="st-card">
            <h2>Payments</h2>
            {payments === null ? (
              <p className="st-muted">
                Not set up yet. Run <code>supabase/payments.sql</code> and follow docs/payments.md.
              </p>
            ) : payments.length === 0 ? (
              <p className="st-muted">No payments received yet.</p>
            ) : (
              <div className="st-scroll">
                <table className="st-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Method</th>
                      <th>Amount</th>
                      <th>TrxID</th>
                      <th>Given to</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.trx_id}>
                        <td>{ago(p.received_at)}</td>
                        <td>{p.method}</td>
                        <td>৳{n(p.amount)}</td>
                        <td>
                          <code>{p.trx_id}</code>
                        </td>
                        <td>
                          {p.email ? (
                            `${p.email} · ${p.days} days`
                          ) : (
                            <span className="st-pill st-pill-bad">{p.waiting_claims > 0 ? 'Claim blocked: check number' : 'Not claimed yet'}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="st-card">
            <h2>Reminders</h2>
            {!health || health.missing ? (
              <p className="st-muted">
                Not set up yet. Run <code>supabase/reminders.sql</code> (see docs/reminders.md).
              </p>
            ) : (
              <>
                <p>
                  <span className={runFresh ? 'st-pill st-pill-ok' : 'st-pill st-pill-bad'}>{runFresh ? 'Running' : 'Not running'}</span>{' '}
                  {lastRun ? `Last run ${ago(lastRun.ran_at)}, ${n(lastRun.sent)} sent.` : 'The job has never run.'} {n(health.people_on)} people have
                  reminders on, on {n(health.devices)} devices.
                </p>
                {!runFresh && <p className="st-muted">The job should run every 10 minutes. Check part 2 of supabase/reminders.sql and docs/reminders.md.</p>}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
