import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabase';

export function ResetPassword() {
  const { clearRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(error.message);
    else clearRecovery();
  }

  return (
    <div className="pt-safe grid min-h-full place-items-center p-4">
      <form onSubmit={submit} className="card flex w-full max-w-sm flex-col gap-4 p-6">
        <h1 className="text-xl font-semibold">Choose a new password</h1>
        <input className="input" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn-primary" disabled={busy}>Save password</button>
      </form>
    </div>
  );
}
