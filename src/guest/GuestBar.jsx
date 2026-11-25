import { useState } from 'react';
import { useI18n } from '../i18n';
import { track } from '../track';
import { choosePassword, guestOff, isGuest, needsPassword, saveWithEmail } from './guest';
import './guest.css';

// One slim strip at the top of the app, only for guests (and, once, for a
// guest who just confirmed their email and still needs a password).
//   guest:          "Trying Mnemoq as a guest · Save my progress · Log in"
//   email sent:     "Check your inbox" until the link is opened
//   needs password: a one-field form to finish the account

const COPY = {
  en: {
    guest: 'You are trying Mnemoq as a guest.',
    guestSub: 'Everything works. Save your progress to keep it on any device.',
    save: 'Save my progress',
    login: 'I have an account',
    email: 'Your email',
    send: 'Save',
    cancel: 'Not now',
    sent: (e) => `Check ${e}: open the link we sent to finish saving. Keep studying meanwhile.`,
    resend: 'Use another email',
    loginWarn: 'Log in to your account? This guest progress will not move over to it.',
    pwTitle: 'Last step: choose a password',
    pwSub: 'So you can log in on any device.',
    pw: 'New password (8+ characters)',
    pwSave: 'Save password',
    wait: 'Please wait…',
    hide: 'Hide',
  },
  bn: {
    guest: 'আপনি অতিথি হিসেবে Mnemoq ব্যবহার করছেন।',
    guestSub: 'সব কিছুই কাজ করে। যেকোনো ডিভাইসে রাখতে অগ্রগতি সংরক্ষণ করুন।',
    save: 'অগ্রগতি সংরক্ষণ করুন',
    login: 'আমার অ্যাকাউন্ট আছে',
    email: 'আপনার ইমেইল',
    send: 'সংরক্ষণ',
    cancel: 'এখন না',
    sent: (e) => `${e} দেখুন: সংরক্ষণ শেষ করতে পাঠানো লিংকটি খুলুন। ততক্ষণ পড়া চালিয়ে যান।`,
    resend: 'অন্য ইমেইল দিন',
    loginWarn: 'আপনার অ্যাকাউন্টে লগ ইন করবেন? এই অতিথি অগ্রগতি সেখানে যাবে না।',
    pwTitle: 'শেষ ধাপ: একটি পাসওয়ার্ড দিন',
    pwSub: 'যাতে যেকোনো ডিভাইসে লগ ইন করতে পারেন।',
    pw: 'নতুন পাসওয়ার্ড (৮+ অক্ষর)',
    pwSave: 'পাসওয়ার্ড সংরক্ষণ',
    wait: 'অপেক্ষা করুন…',
    hide: 'লুকান',
  },
};

export default function GuestBar({ user, onUser, onLogin }) {
  const { lang } = useI18n();
  const c = COPY[lang] || COPY.en;
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState(() => user?.new_email || '');

  if (needsPassword(user)) {
    async function submitPassword(event) {
      event.preventDefault();
      setBusy(true);
      setError('');
      const result = await choosePassword(value);
      setBusy(false);
      if (result.error) setError(result.error);
      else if (result.user) onUser(result.user);
    }

    return (
      <section className="mq-guest mq-guest-pw" aria-label={c.pwTitle}>
        <div className="mq-guest-text">
          <b>{c.pwTitle}</b>
          <span>{c.pwSub}</span>
        </div>
        <form className="mq-guest-form" onSubmit={submitPassword}>
          <input
            type="password"
            autoComplete="new-password"
            placeholder={c.pw}
            aria-label={c.pw}
            minLength={8}
            maxLength={128}
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button className="mq-btn mq-btn-primary" type="submit" disabled={busy}>
            {busy ? c.wait : c.pwSave}
          </button>
        </form>
        {error && <p className="mq-guest-error" role="alert">{error}</p>}
      </section>
    );
  }

  if (!isGuest(user)) return null;

  async function submitEmail(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const result = await saveWithEmail(value);
    setBusy(false);
    if (result.error) setError(result.error);
    else {
      setSentTo(value.trim());
      setOpen(false);
    }
  }

  function login() {
    track('cta_click', { page: 'guest_bar', where: 'login' });
    if (!window.confirm(c.loginWarn)) return;
    guestOff();
    onLogin();
  }

  return (
    <section className="mq-guest" aria-label={c.guest}>
      {sentTo && !open ? (
        <div className="mq-guest-text">
          <span>{c.sent(sentTo)}</span>
          <button type="button" className="mq-guest-link" onClick={() => setOpen(true)}>
            {c.resend}
          </button>
        </div>
      ) : (
        <div className="mq-guest-text">
          <b>{c.guest}</b>
          <span>{c.guestSub}</span>
        </div>
      )}

      {open ? (
        <form className="mq-guest-form" onSubmit={submitEmail}>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={c.email}
            aria-label={c.email}
            maxLength={200}
            required
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button className="mq-btn mq-btn-primary" type="submit" disabled={busy}>
            {busy ? c.wait : c.send}
          </button>
          <button type="button" className="mq-guest-link" onClick={() => setOpen(false)}>
            {c.cancel}
          </button>
        </form>
      ) : (
        !sentTo && (
          <div className="mq-guest-actions">
            <button
              type="button"
              className="mq-btn mq-btn-primary"
              onClick={() => {
                track('cta_click', { page: 'guest_bar', where: 'save' });
                setOpen(true);
              }}
            >
              {c.save}
            </button>
            <button type="button" className="mq-guest-link" onClick={login}>
              {c.login}
            </button>
          </div>
        )
      )}
      {error && <p className="mq-guest-error" role="alert">{error}</p>}
    </section>
  );
}
