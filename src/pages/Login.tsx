import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';
import { BrandLockup } from '../components/Brand';

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setMessage({ kind: 'error', text: navigator.onLine ? (err as Error).message : 'You are offline. Sign in once while online.' });
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    if (!email.trim()) {
      setMessage({ kind: 'error', text: 'Enter your email first.' });
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    setMessage(error ? { kind: 'error', text: error.message } : { kind: 'info', text: 'Check your email for a reset link.' });
  }

  return (
    <div className="pt-safe grid min-h-full place-items-center p-4">
      <form onSubmit={submit} className="card flex w-full max-w-sm flex-col gap-4 p-6">
        <div>
          <h1>
            <BrandLockup size={56} />
          </h1>
          <p className="mt-3 text-base text-fg-2 italic">Sign in to your lists.</p>
        </div>
        <div>
          <label className="field-label" htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="password">Password</label>
          <input id="password" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {message && <p className={`text-base font-semibold ${message.kind === 'error' ? 'text-danger' : 'text-ok'}`}>{message.text}</p>}
        <button className="btn-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <button type="button" className="btn-ghost" onClick={() => void forgot()}>Forgot password?</button>
      </form>
    </div>
  );
}
