import { useState } from 'react';
import { supabase } from './supabaseClient';
import { useI18n } from './i18n';
import { trackEvent } from './googleAnalytics';
import { trafficSource } from './track';
import { guestMetadata } from './guestResult';
import { sampleMetadata } from './sample/store';

// The sign-up / log-in form. Shown inside the landing page (Landing.jsx).
export default function Auth({ startWith = 'signup', compact = false, title = '', subtitle = '' }) {
  const { t } = useI18n();
  const [isSignup, setIsSignup] = useState(startWith !== 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState({ text: '', ok: false });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage({ text: '', ok: false });
    setLoading(true);

    try {
      if (isSignup) {
        const src = trafficSource();
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          // Which post or site brought them, so the Stats page can credit it.
          options: { data: { source: src.source, campaign: src.campaign || null, ...guestMetadata(), ...sampleMetadata() } },
        });

        if (error) throw error;

        // Supabase may return session=null when email confirmation is required.
        // An empty identities array can mean an existing account (anti-enumeration).
        if (data.user && (!Array.isArray(data.user.identities) || data.user.identities.length > 0)) {
          trackEvent('sign_up', { method: 'email' });
        }

        setMessage(
          data.session
            ? { text: 'Account created. Taking you in…', ok: true }
            : { text: 'Almost there: we sent a confirmation link to your email. Open it, then log in here.', ok: true }
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

        if (error) throw error;

        trackEvent('login', { method: 'email' });
      }
    } catch (error) {
      const text = /invalid login/i.test(error.message || '')
        ? 'That email and password do not match. Check them, or create a new account.'
        : /rate limit|too many/i.test(error.message || '')
          ? 'Too many tries. Please wait a minute and try again.'
          : error.message || 'Something went wrong. Please try again.';

      setMessage({ text, ok: false });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className={compact ? 'mq-auth compact' : 'mq-auth'} onSubmit={handleSubmit} noValidate={false}>
      <div className="mq-auth-switch" role="tablist" aria-label="Sign up or log in">
        <button type="button" role="tab" aria-selected={isSignup} className={isSignup ? 'active' : ''} onClick={() => setIsSignup(true)}>
          Sign up free
        </button>
        <button type="button" role="tab" aria-selected={!isSignup} className={!isSignup ? 'active' : ''} onClick={() => setIsSignup(false)}>
          {t('auth.loginBtn')}
        </button>
      </div>

      <h2>{title && isSignup ? title : isSignup ? t('auth.signupTitle') : t('auth.loginTitle')}</h2>
      {isSignup && <p className="mq-auth-sub">{subtitle || 'Free forever plan. No card needed. Takes 20 seconds.'}</p>}

      <label htmlFor="auth-email">{t('auth.email')}</label>
      <input
        id="auth-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        maxLength={200}
        required
      />

      <label htmlFor="auth-password">{t('auth.password')}</label>
      <div className="mq-password">
        <input
          id="auth-password"
          type={showPassword ? 'text' : 'password'}
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          placeholder={isSignup ? 'At least 8 characters' : ''}
          minLength={isSignup ? 8 : 6}
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
          {showPassword ? 'Hide' : 'Show'}
        </button>
      </div>

      <button className="mq-btn mq-btn-primary mq-btn-block" type="submit" disabled={loading}>
        {loading ? t('auth.wait') : isSignup ? 'Create my free account' : t('auth.loginBtn')}
      </button>

      {message.text && (
        <p className={message.ok ? 'mq-auth-msg ok' : 'mq-auth-msg'} role={message.ok ? 'status' : 'alert'}>
          {message.text}
        </p>
      )}

      {isSignup && <p className="mq-auth-fine">By signing up you agree to use Mnemoq for your own study. We never sell your data.</p>}
    </form>
  );
}
