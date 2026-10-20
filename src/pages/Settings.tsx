import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { DEFAULT_COLUMNS, createLabel, deleteLabel, updateArea, updateLabel, updateSettings } from '../db/actions';
import { useAreas, useLabels, usePendingCount, useSettings } from '../db/hooks';
import type { ColumnTemplate } from '../db/types';
import { supabase } from '../lib/supabase';
import { syncNow, useSyncStatus } from '../sync/engine';
import { COLORS, ColorPicker, colorName } from '../components/ColorPicker';
import { useConfirmCompleteSetting } from '../components/ConfirmComplete';
import { TreeNode } from '../components/NodeTree';
import { ColumnsEditor } from '../components/ColumnsEditor';
import { PageHeader } from '../components/PageHeader';
import { DownIcon, UpIcon, XIcon } from '../components/icons';

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
                className={`btn flex-1 border-2 ${settings?.theme === theme ? 'border-accent bg-accent/15 text-fg' : 'border-line-strong text-fg-2'}`}
                onClick={() => void updateSettings({ theme })}
                disabled={!settings}
              >
                {theme === 'dark' ? 'Dark' : 'Light'}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Realm colors" hint="Each realm's color is shared by its projects and the lines in the realm tree.">
          <RealmColors />
        </Section>

        <Section title="Completing tasks">
          <ConfirmCompleteToggle />
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

        <Section title="Tags">
          <LabelsEditor />
        </Section>

        <Section title="Sync">
          <SyncPanel />
        </Section>

        <Section title="Install on iPhone">
          <p className="text-base text-fg-2">
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
      <h2 className="section-title">{title}</h2>
      {hint && <p className="mt-2 text-sm text-fg-2">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function RealmColors() {
  const areas = useAreas() ?? [];
  const [open, setOpen] = useState<string | null>(null);
  if (areas.length === 0) return <p className="text-base text-fg-2">No realms yet. Add one from the Realms tab.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {areas.map((a) => (
        <li key={a.id} className="card">
          <button
            className="flex min-h-14 w-full items-center gap-3 px-4 text-left"
            onClick={() => setOpen((id) => (id === a.id ? null : a.id))}
            aria-expanded={open === a.id}
          >
            <TreeNode kind="realm" color={a.color} />
            <span className="min-w-0 flex-1 truncate text-base font-bold">{a.name}</span>
            <span className="text-sm font-semibold text-fg-2">{colorName(a.color)}</span>
            {open === a.id ? <UpIcon /> : <DownIcon />}
          </button>
          {open === a.id && (
            <div className="border-t border-line p-4">
              <ColorPicker value={a.color} onChange={(color) => void updateArea(a.id, { color })} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function ConfirmCompleteToggle() {
  const [on, setOn] = useConfirmCompleteSetting();
  return (
    <label className="card flex min-h-14 cursor-pointer items-center gap-3 px-4 py-3">
      <input type="checkbox" className="h-6 w-6 shrink-0 accent-[var(--accent)]" checked={on} onChange={(e) => setOn(e.target.checked)} />
      <span className="text-base">
        <b>Ask before completing a task</b>
        <span className="block text-sm text-fg-2">Shows a confirmation when a task moves to a Done column. Applies to this device.</span>
      </span>
    </label>
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
            className="h-9 w-9 shrink-0 cursor-pointer appearance-none rounded-full text-transparent"
            style={{ background: l.color ?? 'var(--muted)' }}
            value={l.color ?? ''}
            onChange={(e) => void updateLabel(l.id, { color: e.target.value })}
            aria-label="Tag color"
          >
            {COLORS.map((c) => (
              <option key={c} value={c} style={{ color: c }}>●</option>
            ))}
          </select>
          <input
            key={l.name}
            className="min-h-11 min-w-0 flex-1 bg-transparent px-1 py-2 font-semibold focus:outline-none"
            defaultValue={l.name}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== l.name) void updateLabel(l.id, { name: v });
            }}
          />
          <button className="p-2 text-fg-2 hover:text-danger" onClick={() => void deleteLabel(l.id)} aria-label="Delete tag">
            <XIcon width={22} height={22} />
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
        <input className="input" placeholder="New tag" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary shrink-0" disabled={!name.trim()}>Add</button>
      </form>
    </div>
  );
}

function SyncPanel() {
  const status = useSyncStatus();
  const pending = usePendingCount();
  return (
    <div className="card flex flex-col gap-3 p-4 text-base">
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
      <p className="text-base text-fg-2">Signed in as <b className="text-fg">{user?.email}</b></p>
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
      {message && <p className="text-base font-semibold text-fg-2">{message}</p>}
      {confirmSignOut ? (
        <div className="card flex flex-col gap-3 p-4 text-base">
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
        <button className="btn-outline self-start" onClick={() => setConfirmSignOut(true)}>Sign out</button>
      )}
    </div>
  );
}
