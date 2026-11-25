import { useEffect, useRef, useState } from 'react';
import { claimPayment, redeemCode } from '../plan';
import { PRO } from '../proConfig';
import { launchActive, launchDaysLeft, percentOff, priceOf, taka } from '../pricing';
import { NO_SUGGEST } from '../noSuggest';
import { pageHref } from '../useRoute';
import { trackEvent } from '../googleAnalytics';
import { track } from '../track';
import { useI18n } from '../i18n';
import { clearPending, loadPending, parentShareText, payText, savePending, whatsappShareUrl } from '../pro/payCopy';
import { feel } from '../sensory';
import '../sat/sat.css';

// Sensory (spec 5, Me/Pro): Pro activation is step.done, never a fanfare
// (it is a payment, keep it plain); access-code and payment errors are error.

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
  ['Practice library (11,000+ questions)', 'Half of every collection', 'Everything'],
  ['Study plan to your test day', false, true],
];

const cell = (value) => (value === true ? <span className="pro-yes">Included</span> : value === false ? <span className="pro-no">Not included</span> : value);

// Pay by bKash (or Nagad, once a number is set) "Send Money", then type the
// TrxID: Pro starts as soon as the payment SMS reaches the server (api/pay.js,
// api/sms-hook.js). Wording lives in src/pro/payCopy.js, in English and Bangla.
const POLL_TRIES = 24;

// "Open bKash and choose <b>Send Money</b>." with the bold part kept.
function withBold(text) {
  const parts = text.split(/<b>(.*?)<\/b>/);

  return parts.map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part));
}

function ParentShare({ offer, lang, number }) {
  const pay = PRO.payment;
  const price = priceOf(offer);
  const [note, setNote] = useState('');
  const text = parentShareText(pay, lang, {
    plan: offer.label,
    price: taka(price.now),
    was: price.was ? taka(price.was) : null,
    endDate: price.was ? longDate(PRO.launch.endsAt) : '',
    number,
  });

  async function other() {
    track('parent_share', { via: navigator.share ? 'share' : 'copy', offer: offer.id });

    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(text);
      setNote(payText(pay, lang, 'parentCopied'));
    } catch {
      setNote('');
    }
  }

  return (
    <div className="pay-parent">
      <a
        className="mq-btn mq-btn-ghost"
        href={whatsappShareUrl(text)}
        target="_blank"
        rel="noreferrer"
        onClick={() => track('parent_share', { via: 'whatsapp', offer: offer.id })}
      >
        {payText(pay, lang, 'parentButton')} · WhatsApp
      </a>
      <button type="button" className="mq-btn mq-btn-ghost" onClick={other}>
        {payText(pay, lang, 'parentOther')}
      </button>
      {note && (
        <span className="pay-parent-note" role="status">
          {note}
        </span>
      )}
    </div>
  );
}

function PayBox({ offer, email, onPlan, lang }) {
  const pay = PRO.payment;
  const price = priceOf(offer);
  const [trx, setTrx] = useState('');
  const [last4, setLast4] = useState('');
  const [state, setState] = useState({ phase: 'idle' }); // idle | checking | waiting | saved | done | error
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  const tries = useRef(0);
  const trxInput = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const number = pay.bkash || pay.nagad;
  const t = (key, vars) => payText(pay, lang, key, vars);

  async function check() {
    const result = await claimPayment(trx, last4);

    if (result.status === 'granted') {
      clearPending();
      feel('step.done');
      trackEvent('pro_redeemed', { days: result.days, method: 'sms' });
      setState({ phase: 'done', days: result.days, until: result.plan.proUntil });
      if (result.plan.pro) onPlan(result.plan);
      return;
    }

    if (result.status === 'waiting') {
      savePending(email, trx, last4);

      if (tries.current < POLL_TRIES) {
        tries.current += 1;
        setState({ phase: 'waiting' });
        timer.current = setTimeout(check, 10000);
        return;
      }

      // Honest timeout: the claim is saved and completes by itself.
      setState({ phase: 'saved' });
      return;
    }

    feel('error');
    setState({ phase: 'error', text: result.status === 'mismatch' ? t('mismatch') : result.error });
  }

  function submit(event) {
    event.preventDefault();
    clearTimeout(timer.current);
    tries.current = 0;
    setState({ phase: 'checking' });
    check();
  }

  function edit() {
    clearTimeout(timer.current);
    setState({ phase: 'idle' });
    setTimeout(() => trxInput.current?.focus(), 0);
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
          Payment received. {state.days} days of Pro added
          {state.until ? (
            <>
              , until <b>{longDate(state.until)}</b>
            </>
          ) : null}
          . Everything is unlocked now.
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
        <p>{t('payWith')}</p>
      </header>
      <ol className="pay-steps">
        <li>{withBold(t('stepOpen'))}</li>
        <li>
          Send <b>{taka(price.now)}</b> to{' '}
          <span className="pay-number">
            <b>{number}</b>
            <button type="button" className="mq-btn mq-btn-ghost" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </span>
        </li>
        <li>{t('stepType')}</li>
      </ol>
      <ParentShare offer={offer} lang={lang} number={number} />
      {busy || state.phase === 'saved' ? (
        <div className="pay-echo">
          <span className="pay-echo-label">{t('checkingTrx')}</span>
          <code className="pay-echo-trx">{trx}</code>
          <button type="button" className="mq-btn mq-btn-ghost" onClick={edit}>
            {t('edit')}
          </button>
        </div>
      ) : (
        <form className="pay-form" onSubmit={submit}>
          <label>
            Transaction ID (TrxID)
            <input
              ref={trxInput}
              value={trx}
              onChange={(e) => setTrx(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="e.g. BKA1B2C3D4"
              maxLength={20}
              required
              {...NO_SUGGEST}
            />
          </label>
          <label>
            {t('last4Label')}
            <input
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              placeholder="5678"
              maxLength={4}
              required
            />
          </label>
          <button type="submit" className="mq-btn mq-btn-primary" disabled={trx.length < 6 || last4.length !== 4}>
            Activate Pro
          </button>
        </form>
      )}
      {(state.phase === 'idle' || state.phase === 'error') && <p className="sat-fineprint pay-hint">{t('parentHint')}</p>}
      {state.phase === 'checking' && (
        <p className="pay-wait" role="status">
          <span className="pay-spinner" aria-hidden="true" /> {t('checking')}
        </p>
      )}
      {state.phase === 'waiting' && (
        <p className="pay-wait" role="status">
          <span className="pay-spinner" aria-hidden="true" /> {t('waiting')}
        </p>
      )}
      {state.phase === 'saved' && (
        <p className="pro-message ok" role="status">
          {t('timeout', { trx })}
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

// A claim from an earlier visit that was still waiting: "Payment pending: TrxID".
// Checks once on open (the same TrxID adds no new rows), and on request.
function PendingPayment({ email, onPlan, lang }) {
  const pay = PRO.payment;
  const [pending, setPending] = useState(() => loadPending(email));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const checkedOnce = useRef(false);

  async function recheck() {
    if (!pending) return;

    setBusy(true);
    const result = await claimPayment(pending.trx, pending.last4);
    setBusy(false);

    if (result.status === 'granted') {
      clearPending();
      setPending(null);
      feel('step.done');
      if (result.plan.pro) onPlan(result.plan);
      setMessage({ ok: true, text: payText(pay, lang, 'pendingDone', { days: result.days }) });
      return;
    }

    // Still waiting, or the server could not be reached: keep remembering it.
    if (result.status === 'waiting' || result.status === 'failed' || result.status === 'auth') return;

    // Mismatch, used, wrong amount...: say why and stop remembering it.
    clearPending();
    setPending(null);
    feel('error');
    setMessage({ ok: false, text: result.status === 'mismatch' ? payText(pay, lang, 'mismatch') : result.error });
  }

  useEffect(() => {
    if (pending && !checkedOnce.current) {
      checkedOnce.current = true;
      recheck();
    }
    // Runs once on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (message) {
    return (
      <p className={message.ok ? 'pro-message ok' : 'pro-message'} role={message.ok ? 'status' : 'alert'}>
        {message.text}
      </p>
    );
  }

  if (!pending) return null;

  return (
    <section className="path-card pay-pending" role="status">
      <h3>{payText(pay, lang, 'pendingTitle', { trx: pending.trx })}</h3>
      <p>{payText(pay, lang, 'pendingBody')}</p>
      <div className="pay-pending-actions">
        <button type="button" className="mq-btn mq-btn-primary" onClick={recheck} disabled={busy}>
          {busy ? payText(pay, lang, 'checking') : payText(pay, lang, 'pendingCheck')}
        </button>
        {pay.contactUrl && (
          <a className="mq-btn mq-btn-ghost" href={pay.contactUrl} target="_blank" rel="noreferrer">
            {pay.contactLabel || 'Contact us'}
          </a>
        )}
      </div>
    </section>
  );
}

export default function ProPage({ plan, onPlan, email }) {
  const { lang } = useI18n();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { ok, text }
  const [chosen, setChosen] = useState((PRO.offers.find((o) => o.best) || PRO.offers[0]).id);

  async function submit(event) {
    event.preventDefault();

    if (busy) return;

    feel('tap.primary');
    setBusy(true);
    setMessage(null);

    const result = await redeemCode(code);

    setBusy(false);

    if (result.error) {
      feel('error');
      setMessage({ ok: false, text: result.error });
      return;
    }

    feel('step.done');
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
                onClick={() => {
                  feel('select');
                  setChosen(offer.id);
                }}
              >
                {offer.best && <span className="pro-offer-tag">{payText(PRO.payment, lang, 'planTag')}</span>}
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

      <PendingPayment email={email} onPlan={onPlan} lang={lang} />

      <PayBox offer={PRO.offers.find((o) => o.id === chosen) || PRO.offers[0]} email={email} onPlan={onPlan} lang={lang} />

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
