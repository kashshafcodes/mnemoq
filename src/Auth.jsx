
import { useState } from 'react';
import { supabase } from './supabaseClient';
import { LanguageToggle, useI18n } from './i18n';
import { trackEvent } from './googleAnalytics';

export default function Auth({ onLogin }) {
  const { t } = useI18n();
  const [isSignup, setIsSignup] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  
async function handleSubmit(event) {
  event.preventDefault();
  setMessage('');
  setLoading(true);

  try {
    if (isSignup) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      // Supabase may return session=null when email confirmation is required.
      // The account creation request still succeeded, so count the signup.
      // An empty identities array can indicate an existing account (anti-enumeration).
      if (data.user && (!Array.isArray(data.user.identities) || data.user.identities.length > 0)) {
        trackEvent('sign_up', { method: 'email' });
      }

      if (data.session) {
        setMessage('Account created successfully!');
      } else {
        setMessage(
          'Account created. Check your email for a confirmation link before logging in.'
        );
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      trackEvent('login', { method: 'email' });
      setMessage('Login successful!');
    }
  } catch (error) {
    setMessage(error.message || 'Something went wrong. Please try again.');
  } finally {
    setLoading(false);
  }
}


  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <LanguageToggle />
        <p className="eyebrow">MNEMOQ</p>
        <h1>{isSignup ? t('auth.signupTitle') : t('auth.loginTitle')}</h1>
        <p>{t('auth.tagline')}</p>

        <label htmlFor="auth-email">{t('auth.email')}</label>
        <input
          id="auth-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label htmlFor="auth-password">{t('auth.password')}</label>
        <input
          id="auth-password"
          type="password"
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          minLength={6}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? t('auth.wait') : isSignup ? t('auth.createBtn') : t('auth.loginBtn')}
        </button>

        {message && <p role="status">{message}</p>}

        <button
          className="auth-toggle"
          type="button"
          onClick={() => {
            setIsSignup(!isSignup);
            setMessage('');
          }}
        >
          {isSignup ? t('auth.haveAccount') : t('auth.noAccount')}
        </button>
      </form>
    </main>
  );
}
