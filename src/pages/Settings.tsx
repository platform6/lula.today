import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { DEFAULT_COLUMNS, createLabel, deleteLabel, updateLabel, updateSettings } from '../db/actions';
import { useLabels, usePendingCount, useSettings } from '../db/hooks';
import type { ColumnTemplate } from '../db/types';
import { supabase } from '../lib/supabase';
import { syncNow, useSyncStatus } from '../sync/engine';
import { COLORS } from '../components/ColorPicker';
import { ColumnsEditor } from '../components/ColumnsEditor';
import { PageHeader } from '../components/PageHeader';
import { XIcon } from '../components/icons';

export function Settings() {
  const settings = useSettings();
  const templates = settings?.default_columns ?? DEFAULT_COLUMNS;

  const saveTemplates = (next: ColumnTemplate[]) => void updateSettings({ default_columns: next });

  return (
    <div>
      <PageHeader title="Settings" />
      <div className="mx-auto flex max-w-xl flex-col gap-8 p-4">
        <Section title="Appearance">
          <div className="flex gap-2">
            {(['dark', 'light'] as const).map((theme) => (
              <button
                key={theme}
                className={`btn flex-1 border ${settings?.theme === theme ? 'border-accent text-fg' : 'border-line text-muted'}`}
                onClick={() => void updateSettings({ theme })}
                disabled={!settings}
              >
                {theme === 'dark' ? 'Dark' : 'Light'}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Default columns" hint="Used when you create a new project. Existing projects are not changed.">
          <ColumnsEditor
            columns={templates.map((c, i) => ({ key: String(i), name: c.name, is_done: c.is_done }))}
            onRename={(key, name) => saveTemplates(templates.map((c, i) => (String(i) === key ? { ...c, name } : c)))}
            onToggleDone={(key, is_done) => saveTemplates(templates.map((c, i) => (String(i) === key ? { ...c, is_done } : c)))}
            onMove={(key, dir) => {
              const from = Number(key);
              const to = from + dir;
              if (to < 0 || to >= templates.length) return;
              const next = [...templates];
              [next[from], next[to]] = [next[to], next[from]];
              saveTemplates(next);
            }}
            onDelete={(key) => saveTemplates(templates.filter((_, i) => String(i) !== key))}
            onAdd={(name) => saveTemplates([...templates, { name, is_done: false }])}
          />
        </Section>

        <Section title="Labels">
          <LabelsEditor />
        </Section>

        <Section title="Sync">
          <SyncPanel />
        </Section>

        <Section title="Install on iPhone">
          <p className="text-sm text-muted">
            In Safari, tap <b>Share</b> → <b>Add to Home Screen</b>, then open lula from the Home Screen and sign in
            there. The installed app keeps its own offline copy of your data.
          </p>
        </Section>

        <Section title="Account">
          <AccountPanel />
        </Section>
      </div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-semibold">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function LabelsEditor() {
  const labels = useLabels() ?? [];
  const [name, setName] = useState('');

  return (
    <div className="flex flex-col gap-2">
      {labels.map((l) => (
        <div key={l.id} className="card flex items-center gap-2 p-2">
          <select
            className="h-7 w-7 shrink-0 cursor-pointer appearance-none rounded-full text-transparent"
            style={{ background: l.color ?? 'var(--muted)' }}
            value={l.color ?? ''}
            onChange={(e) => void updateLabel(l.id, { color: e.target.value })}
            aria-label="Label color"
          >
            {COLORS.map((c) => (
              <option key={c} value={c} style={{ color: c }}>●</option>
            ))}
          </select>
          <input
            key={l.name}
            className="min-w-0 flex-1 bg-transparent px-1 py-1.5 focus:outline-none"
            defaultValue={l.name}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== l.name) void updateLabel(l.id, { name: v });
            }}
          />
          <button className="p-1.5 text-muted hover:text-danger" onClick={() => void deleteLabel(l.id)} aria-label="Delete label">
            <XIcon width={16} height={16} />
          </button>
        </div>
      ))}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = name.trim();
          if (v) void createLabel(v, COLORS[labels.length % COLORS.length]);
          setName('');
        }}
      >
        <input className="input" placeholder="New label" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary shrink-0" disabled={!name.trim()}>Add</button>
      </form>
    </div>
  );
}

function SyncPanel() {
  const status = useSyncStatus();
  const pending = usePendingCount();
  return (
    <div className="card flex flex-col gap-2 p-4 text-sm">
      <div className="flex justify-between">
        <span className="text-muted">Status</span>
        <span className="capitalize">{status.state}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted">Last synced</span>
        <span>{status.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleTimeString() : '—'}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted">Changes waiting to upload</span>
        <span>{pending}</span>
      </div>
      {status.error && <p className="text-danger">{status.error}</p>}
      <button className="btn-primary mt-1" onClick={() => void syncNow()} disabled={status.state === 'syncing'}>
        Sync now
      </button>
    </div>
  );
}

function AccountPanel() {
  const { user, signOut } = useAuth();
  const pending = usePendingCount();
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password });
    setMessage(error ? error.message : 'Password updated.');
    if (!error) setPassword('');
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">Signed in as {user?.email}</p>
      <form className="flex gap-2" onSubmit={changePassword}>
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          minLength={8}
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="btn-primary shrink-0" disabled={password.length < 8}>Change</button>
      </form>
      {message && <p className="text-sm text-muted">{message}</p>}
      {confirmSignOut ? (
        <div className="card flex flex-col gap-2 p-3 text-sm">
          <p>
            Signing out removes the offline copy from this device.
            {pending > 0 && <b className="text-danger"> {pending} change(s) haven’t uploaded yet and will be lost.</b>}
          </p>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setConfirmSignOut(false)}>Cancel</button>
            <button className="btn-danger" onClick={() => void signOut()}>Sign out</button>
          </div>
        </div>
      ) : (
        <button className="btn-ghost self-start" onClick={() => setConfirmSignOut(true)}>Sign out</button>
      )}
    </div>
  );
}
