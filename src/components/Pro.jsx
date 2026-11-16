import { useEffect, useRef, useState } from 'react';
import { claimPayment, redeemCode } from '../plan';
import { PRO } from '../proConfig';
import { launchActive, launchDaysLeft, percentOff, priceOf, taka } from '../pricing';
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
            See Pro plans{from ? ` · from ${taka(priceOf(from).now)}` : ''}
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
  ['AI coach analysis', 'First one', 'After every test'],
  ['AI uses a day', '5', '50'],
  ['Practice library (11,000+ questions)', 'First set of each', 'Everything'],
  ['Study plan to your test day', false, true],
];

const cell = (value) => (value === true ? <span className="pro-yes">Included</span> : value === false ? <span className="pro-no">Not included</span> : value);

// Pay by bKash / Nagad "Send Money", then type the TrxID: Pro starts as soon as
// the payment SMS reaches the server (api/pay.js, api/sms-hook.js).
function PayBox({ offer, email, onPlan }) {
  const pay = PRO.payment;
  const price = priceOf(offer);
  const [trx, setTrx] = useState('');
  const [last4, setLast4] = useState('');
  const [state, setState] = useState({ phase: 'idle' }); // idle | checking | waiting | done | error
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  const tries = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const number = pay.bkash || pay.nagad;

  async function check() {
    const result = await claimPayment(trx, last4);

    if (result.status === 'granted') {
      trackEvent('pro_redeemed', { days: result.days, method: 'sms' });
      setState({ phase: 'done', days: result.days, until: result.plan.proUntil });
      onPlan(result.plan);
      return;
    }

    if (result.status === 'waiting' && tries.current < 24) {
      tries.current += 1;
      setState({ phase: 'waiting' });
      timer.current = setTimeout(check, 10000);
      return;
    }

    setState({
      phase: 'error',
      text:
        result.status === 'waiting'
          ? 'We have not received this payment yet. If you sent it, message us with the transaction ID and we will switch Pro on by hand.'
          : result.error,
    });
  }

  function submit(event) {
    event.preventDefault();
    clearTimeout(timer.current);
    tries.current = 0;
    setState({ phase: 'checking' });
    check();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(number);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  if (!number) return null;

  if (state.phase === 'done') {
    return (
      <section className="path-card pay-box pay-done" role="status">
        <h3>You are on Pro 🎉</h3>
        <p>
          Payment received. {state.days} days of Pro added, until <b>{longDate(state.until)}</b>. Everything is unlocked now.
        </p>
      </section>
    );
  }

  const busy = state.phase === 'checking' || state.phase === 'waiting';

  return (
    <section className="path-card pay-box">
      <header>
        <h3>
          Get {offer.label} of Pro for {taka(price.now)}
          {price.was && <s>{taka(price.was)}</s>}
        </h3>
        <p>Pay with {pay.bkash && pay.nagad ? 'bKash or Nagad' : pay.bkash ? 'bKash' : 'Nagad'}. Pro starts automatically, usually within a minute.</p>
      </header>
      <ol className="pay-steps">
        <li>
          Open {pay.bkash && pay.nagad ? 'bKash or Nagad' : pay.bkash ? 'bKash' : 'Nagad'} and choose <b>Send Money</b>.
        </li>
        <li>
          Send <b>{taka(price.now)}</b> to{' '}
          <span className="pay-number">
            <b>{number}</b>
            <button type="button" className="mq-btn mq-btn-ghost" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </span>
        </li>
        <li>Type the transaction ID (TrxID) from the confirmation SMS and the last 4 digits of the number you paid from.</li>
      </ol>
      <form className="pay-form" onSubmit={submit}>
        <label>
          Transaction ID
          <input
            value={trx}
            onChange={(e) => setTrx(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            placeholder="e.g. BKA1B2C3D4"
            maxLength={20}
            required
            {...NO_SUGGEST}
          />
        </label>
        <label>
          Your number, last 4 digits
          <input
            value={last4}
            onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            placeholder="5678"
            maxLength={4}
            required
          />
        </label>
        <button type="submit" className="mq-btn mq-btn-primary" disabled={busy || trx.length < 6 || last4.length !== 4}>
          {busy ? 'Checking…' : 'Activate Pro'}
        </button>
      </form>
      {state.phase === 'waiting' && (
        <p className="pay-wait" role="status">
          <span className="pay-spinner" aria-hidden="true" /> Waiting for your payment to arrive. Keep this page open; it usually takes under a minute.
        </p>
      )}
      {state.phase === 'error' && (
        <p className="pro-message" role="alert">
          {state.text}
        </p>
      )}
      <p className="sat-fineprint">
        One payment, no automatic renewal. Paying again adds days to what you have left.
        {pay.contactUrl && (
          <>
            {' '}Need help?{' '}
            <a href={pay.contactUrl} target="_blank" rel="noreferrer">
              {pay.contactLabel || 'Contact us'}
            </a>
            {email ? ` (mention ${email})` : ''}.
          </>
        )}
      </p>
    </section>
  );
}

export default function ProPage({ plan, onPlan, email }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { ok, text }
  const [chosen, setChosen] = useState((PRO.offers.find((o) => o.best) || PRO.offers[0]).id);

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

      <section className="path-card">
        <header>
          <h3>Choose your plan</h3>
          <p>One payment, no automatic renewal. Buying again adds days to what you have left.</p>
        </header>
        {launchActive() && (
          <p className="pro-launch">
            <b>{PRO.launch.name}: half price</b> for everyone who joins now. Ends {longDate(PRO.launch.endsAt)}
            {launchDaysLeft() <= 14 && <> ({launchDaysLeft()} {launchDaysLeft() === 1 ? 'day' : 'days'} left)</>}. After that, the regular
            price applies.
          </p>
        )}
        <div className="pro-offers">
          {PRO.offers.map((offer) => {
            const price = priceOf(offer);

            return (
              <button
                key={offer.id}
                type="button"
                className={`${offer.best ? 'pro-offer best' : 'pro-offer'}${chosen === offer.id ? ' chosen' : ''}`}
                aria-pressed={chosen === offer.id}
                onClick={() => setChosen(offer.id)}
              >
                {offer.best && <span className="pro-offer-tag">Most popular</span>}
                <strong>{offer.label}</strong>
                <span className="pro-price">
                  <b>{taka(price.now)}</b>
                  {price.was && <s aria-label={`regular price ${taka(price.was)}`}>{taka(price.was)}</s>}
                </span>
                {price.was ? <span className="pro-save">Save {percentOff(offer)}%</span> : null}
                <small>{offer.note}</small>
              </button>
            );
          })}
        </div>
      </section>

      <PayBox offer={PRO.offers.find((o) => o.id === chosen) || PRO.offers[0]} email={email} onPlan={onPlan} />

      <section className="pro-benefits">
        {PRO.benefits.map((b) => (
          <article key={b.id}>
            <h3>{b.title}</h3>
            <p>{b.detail}</p>
          </article>
        ))}
      </section>

      <section className="path-card">
        <details className="pro-code-box">
          <summary>Have an access code?</summary>
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
        </details>
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
