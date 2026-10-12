
import { useState } from 'react';
import { supabase } from './supabaseClient';

export default function Auth({ onLogin }) {
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
        <p className="eyebrow">MNEMOQ</p>
        <h1>{isSignup ? 'Create your account' : 'Welcome back'}</h1>
        <p>Build stronger recall, one mistake at a time.</p>

        <label htmlFor="auth-email">Email</label>
        <input
          id="auth-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label htmlFor="auth-password">Password</label>
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
          {loading ? 'Please wait...' : isSignup ? 'Create account' : 'Log in'}
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
          {isSignup
            ? 'Already have an account? Log in'
            : "Don't have an account? Sign up"}
        </button>
      </form>
    </main>
  );
}
