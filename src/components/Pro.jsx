import { useEffect, useRef, useState } from 'react';
import { redeemCode } from '../plan';
import { PRO, hasPaymentDetails } from '../proConfig';
import { NO_SUGGEST } from '../noSuggest';
import { pageHref } from '../useRoute';
import { trackEvent } from '../googleAnalytics';
import '../sat/sat.css';

// Mnemoq Pro on screen: the small lock and badge, the upgrade prompt shown
// when a free account reaches a Pro feature, and the Pro page itself.

export function LockIcon() {
  return (
    <svg className="pro-lock" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="3" y="7" width="10" height="7" rx="2" fill="currentColor" />
    </svg>
  );
}

export function ProBadge({ children = 'Pro' }) {
  return (
    <span className="pro-badge">
      <LockIcon />
      {children}
    </span>
  );
}

const longDate = (date) => new Date(date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

// The prompt shown when a free account reaches a Pro feature.
//   prompt: { feature, reason } where feature is a benefit id from proConfig.
export function Paywall({ prompt, onClose }) {
  const closeRef = useRef(null);
  const lead = PRO.benefits.find((b) => b.id === prompt.feature) || PRO.benefits[0];
  const others = PRO.benefits.filter((b) => b.id !== lead.id).slice(0, 3);
  const from = PRO.offers[0];

  useEffect(() => {
    closeRef.current?.focus();

    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="pro-overlay" role="presentation" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="pro-sheet" role="dialog" aria-modal="true" aria-labelledby="pro-sheet-title">
        <p className="eyebrow">MNEMOQ PRO</p>
        <h3 id="pro-sheet-title">{lead.title}</h3>
        <p className="pro-sheet-reason">{prompt.reason || lead.detail}</p>
        <ul className="pro-sheet-list">
          <li>
            <b>{lead.title}.</b> {lead.detail}
          </li>
          {others.map((b) => (
            <li key={b.id}>
              <b>{b.title}.</b> {b.detail}
            </li>
          ))}
        </ul>
        <div className="pro-sheet-actions">
          <a className="qa-primary" href={pageHref('pro')} onClick={onClose}>
            See Pro plans{from ? ` · from ${from.price}` : ''}
          </a>
          <button type="button" className="ghost-button" ref={closeRef} onClick={onClose}>
            Not now
          </button>
        </div>
        <p className="pro-sheet-foot">Already have a code? Redeem it on the Pro page.</p>
      </div>
    </div>
  );
}

const COMPARE = [
  ['Diagnostic, score estimate and skill map', true, true],
  ['Bluebook score log and score history', true, true],
  ['Skill drills', '3 a day', 'Unlimited'],
  ['Timed modules', 'One per section each week', 'Unlimited'],
  ['Question bank', 'Starter set', 'Everything'],
  ['Explanation for every missed question', true, true],
  ['Misses to review cards', true, true],
  ['SAT essentials decks', true, true],
  ['Full adaptive practice tests', false, true],
  ['AI coach analysis', false, true],
  ['Study plan to your test day', false, true],
];

const cell = (value) => (value === true ? <span className="pro-yes">Included</span> : value === false ? <span className="pro-no">Not included</span> : value);

export default function ProPage({ plan, onPlan, email }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { ok, text }
  const pay = PRO.payment;

  async function submit(event) {
    event.preventDefault();

    if (busy) return;

    setBusy(true);
    setMessage(null);

    const result = await redeemCode(code);

    setBusy(false);

    if (result.error) {
      setMessage({ ok: false, text: result.error });
      return;
    }

    trackEvent('pro_redeemed', { days: result.days });

    setCode('');
    setMessage({ ok: true, text: `Done. ${result.days} days of Pro added. You are Pro until ${longDate(result.plan.proUntil)}.` });
    onPlan(result.plan);
  }

  return (
    <div className="pro-page">
      <section className="pro-hero">
        <p className="eyebrow">MNEMOQ PRO</p>
        <h2>Everything you need to reach your target score</h2>
        <p>
          The free plan is enough to start and keep improving. Pro is the full training ground: adaptive tests, the
          whole question bank, unlimited practice and a plan to your test day.
        </p>
        {plan.pro ? (
          <p className="pro-status on">
            You are on Pro until <b>{longDate(plan.proUntil)}</b> ({plan.daysLeft} {plan.daysLeft === 1 ? 'day' : 'days'} left).
          </p>
        ) : (
          <p className="pro-status">You are on the free plan.</p>
        )}
      </section>

      <section className="pro-benefits">
        {PRO.benefits.map((b) => (
          <article key={b.id}>
            <h3>{b.title}</h3>
            <p>{b.detail}</p>
          </article>
        ))}
      </section>

      <section className="path-card">
        <header>
          <h3>Choose your plan</h3>
          <p>One payment, no automatic renewal. Buying again adds days to what you have left.</p>
        </header>
        <div className="pro-offers">
          {PRO.offers.map((offer) => (
            <div key={offer.id} className={offer.best ? 'pro-offer best' : 'pro-offer'}>
              {offer.best && <span className="pro-offer-tag">Most popular</span>}
              <strong>{offer.label}</strong>
              <b>{offer.price}</b>
              <small>{offer.note}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="path-card">
        <header>
          <h3>How to get Pro</h3>
        </header>
        {hasPaymentDetails() ? (
          <ol className="pro-steps">
            <li>
              Send the amount for your plan
              {pay.bkash && <> by bKash to <b>{pay.bkash}</b></>}
              {pay.bkash && pay.nagad && ' or'}
              {pay.nagad && <> by Nagad to <b>{pay.nagad}</b></>}
              .
            </li>
            <li>
              Send your payment reference and the email you use for Mnemoq{email ? <> (<b>{email}</b>)</> : ''}
              {pay.contactUrl && (
                <>
                  {' '}to{' '}
                  <a href={pay.contactUrl} target="_blank" rel="noreferrer">
                    {pay.contactLabel || 'our support'}
                  </a>
                </>
              )}
              {pay.email && (
                <>
                  {pay.contactUrl ? ' or ' : ' to '}
                  <a href={`mailto:${pay.email}`}>{pay.email}</a>
                </>
              )}
              .
            </li>
            <li>You receive an access code. Enter it below and Pro starts at once.</li>
          </ol>
        ) : (
          <p className="sat-muted">Pro is unlocked with an access code. Ask the Mnemoq team for one, then enter it below.</p>
        )}

        <form className="pro-redeem" onSubmit={submit}>
          <label htmlFor="pro-code">Access code</label>
          <div>
            <input
              id="pro-code"
              type="text"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="MNQ-XXXX-XXXX-XXXX"
              maxLength={24}
              {...NO_SUGGEST}
            />
            <button type="submit" className="qa-primary" disabled={busy || code.trim().length < 8}>
              {busy ? 'Checking...' : 'Redeem'}
            </button>
          </div>
          {message && (
            <p className={message.ok ? 'pro-message ok' : 'pro-message'} role={message.ok ? 'status' : 'alert'}>
              {message.text}
            </p>
          )}
          {plan.setup && <p className="sat-fineprint">Site owner: run supabase/stage5.sql in Supabase to switch Pro on.</p>}
        </form>
      </section>

      <section className="path-card">
        <header>
          <h3>Free and Pro, side by side</h3>
        </header>
        <div className="sat-table-wrap">
          <table className="pro-compare">
            <thead>
              <tr>
                <th scope="col">SAT path</th>
                <th scope="col">Free</th>
                <th scope="col">Pro</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map(([name, free, pro]) => (
                <tr key={name}>
                  <th scope="row">{name}</th>
                  <td>{cell(free)}</td>
                  <td>{cell(pro)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="sat-fineprint">
          Your cards, reviews and everything outside the SAT path stay free. If Pro ends, your results and cards are kept.
        </p>
      </section>
    </div>
  );
}
