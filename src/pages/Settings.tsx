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
import { UI_SIZES, useUiSize } from '../lib/uiSize';

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
          <UiSizePicker />
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

        <Section title="Working on lula with Claude" hint="How app ideas get from your board into the app.">
          <ClaudeGuide />
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

const code = 'rounded-sm bg-surface-2 px-1.5 py-0.5 font-mono text-sm text-fg';

/** A reminder of the Remote Control + board workflow (AGENTS.md has the agents' side of it). */
function ClaudeGuide() {
  return (
    <details className="card group px-4 py-3">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-semibold">
        Show how it works
        <DownIcon className="text-fg-2 transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-3 flex flex-col gap-4 text-base text-fg-2">
        <div>
          <h3 className="font-bold text-fg">1. Capture ideas</h3>
          <p>
            Add cards to <b className="text-fg">Dev › Lula</b>. Keep rough ideas in Backlog; move a card to <b className="text-fg">To Do</b>{' '}
            when it's ready to build. Claude only takes cards from To Do.
          </p>
        </div>
        <div>
          <h3 className="font-bold text-fg">2. Start a session</h3>
          <p>
            On the computer, open a terminal in <code className={code}>C:\dev\listing_things_living_life</code>, run{' '}
            <code className={code}>claude</code>, then <code className={code}>/remote-control</code>. Carry on from your phone in the
            Claude app. The computer has to stay on and awake.
          </p>
        </div>
        <div>
          <h3 className="font-bold text-fg">3. Ask for work</h3>
          <p>
            Type <code className={code}>/next-card</code> to have Claude take the top card in To Do, or{' '}
            <code className={code}>/next-card 0dc670dc</code> for a particular one (open the task and tap the id at the bottom, above
            Created, to copy it). Or just say <i>"work the To Do cards"</i>.
          </p>
        </div>
        <div>
          <h3 className="font-bold text-fg">4. Follow it across the board</h3>
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
            <li>
              <b className="text-fg">Doing</b>: Claude is on it, and leaves notes on the card as it goes. An unclear card gets a
              question in its notes and stays in To Do.
            </li>
            <li>
              Nothing is committed or pushed until you say so: type <code className={code}>/cp</code> (or say{' '}
              <i>"commit and push"</i>).
            </li>
            <li>
              <b className="text-fg">UAT</b>: pushed and waiting for you. Tap <b className="text-fg">Update available</b> in the app,
              then try it.
            </li>
            <li>
              <b className="text-fg">Done</b>: you move it there once it works. Claude never does.
            </li>
          </ul>
        </div>
        <div>
          <h3 className="font-bold text-fg">Slash commands</h3>
          <p>Type these in the Claude session (on the computer or from the phone).</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
            <dt>
              <code className={code}>/remote-control</code>
            </dt>
            <dd>Connects the session to the Claude app so you can carry on from your phone. Built into Claude Code.</dd>
            <dt>
              <code className={code}>/next-card</code>
            </dt>
            <dd>
              Takes the top card in To Do: reads its notes and steps, moves it to Doing, builds it and runs the checks, then
              asks before committing.
            </dd>
            <dt>
              <code className={code}>/next-card &lt;id&gt;</code>
            </dt>
            <dd>The same, for one particular card (it must be in To Do).</dd>
            <dt>
              <code className={code}>/cp</code>
            </dt>
            <dd>
              Commit and push. Runs the checks first, then moves the finished cards from Doing to UAT. Typing it is your
              go-ahead.
            </dd>
          </dl>
          <p className="mt-2">
            The commands live in <code className={code}>.claude/commands/</code>; edit those files to change what they do.
          </p>
        </div>
        <div>
          <h3 className="font-bold text-fg">Behind the scenes</h3>
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-5">
            <li>
              Claude reads and moves cards with <code className={code}>npm run board -- help</code> (the list of commands).
            </li>
            <li>
              It signs in with your login from <code className={code}>.env.local</code>; permission to run it without asking is in{' '}
              <code className={code}>.claude/settings.local.json</code>. Both stay on this computer.
            </li>
            <li>
              The rules agents follow are in <code className={code}>AGENTS.md</code> (Claude Code and Codex both read
              it); edit it to change the flow. In Codex, say <i>"work the next card"</i> or <i>"commit and push"</i>.
            </li>
          </ul>
        </div>
      </div>
    </details>
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

function UiSizePicker() {
  const [size, setSize] = useUiSize();
  return (
    <div className="mt-4">
      <span className="field-label">Size</span>
      <div className="flex gap-2">
        {UI_SIZES.map((s) => (
          <button
            key={s}
            className={`btn flex-1 border-2 capitalize ${size === s ? 'border-accent bg-accent/15 text-fg' : 'border-line-strong text-fg-2'}`}
            onClick={() => setSize(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-fg-2">Scales text and controls. Applies to this device.</p>
    </div>
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
      {/* the build's commit, matching the "Committed in …" notes on board cards */}
      <div className="flex justify-between">
        <span className="text-muted">Version</span>
        <span className="font-mono" title={`Built ${new Date(__BUILD_TIME__).toLocaleString()}`}>
          {__APP_VERSION__}
        </span>
      </div>
      <div className="flex flex-wrap justify-between gap-x-4 gap-y-1">
        <span className="text-muted">Last build</span>
        <time dateTime={__BUILD_TIME__}>
          {new Date(__BUILD_TIME__).toLocaleDateString('en-US', {
            year: '2-digit', month: '2-digit', day: '2-digit',
          })}{' '}
          {new Date(__BUILD_TIME__).toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
          })}
        </time>
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
