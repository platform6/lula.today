import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteList, deleteListItem, saveList, saveListItem, useListItems, useLists } from '../db/lists';
import type { ExperienceList, ListItem, ListKind } from '../db/types';
import { LIST_FIELDS, LIST_KINDS, listKindLabel } from '../lib/lists';
import { PageHeader } from '../components/PageHeader';
import { Sheet } from '../components/Sheet';
import { BackIcon, PlusIcon } from '../components/icons';

export function Lists() {
  const lists = useLists();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <PageHeader title="Lists" actions={<button className="btn-primary" onClick={() => setAdding(true)}><PlusIcon /> New list</button>} />
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <p className="text-fg-2">Keep a record of the things you’ve experienced — games, concerts, shows, and anything else worth remembering.</p>
        {!lists ? <p>Loading…</p> : lists.length === 0 ? (
          <div className="card p-6 text-center">
            <h2 className="text-lg font-bold">Your memories start here</h2>
            <p className="mt-2 text-fg-2">Create your first list when something comes to mind.</p>
            <button className="btn-outline mt-4" onClick={() => setAdding(true)}>Create a list</button>
          </div>
        ) : <ul className="space-y-3">{lists.map((list) => (
          <li key={list.id}><Link className="card block p-4 hover:bg-surface-2" to={`/lists/${list.id}`}>
            <span className="text-xs font-semibold text-muted">{listKindLabel(list.kind)}</span>
            <h2 className="break-words text-xl font-bold">{list.name}</h2>
            {list.description && <p className="mt-1 whitespace-pre-wrap break-words text-fg-2">{list.description}</p>}
          </Link></li>
        ))}</ul>}
      </div>
      {adding && <ListEditor onClose={() => setAdding(false)} onSaved={(id) => navigate(`/lists/${id}`)} />}
    </div>
  );
}

export function ListPage() {
  const { id = '' } = useParams();
  const lists = useLists();
  const list = lists?.find((l) => l.id === id);
  if (!lists) return <p className="p-4">Loading…</p>;
  if (!list) return <div className="p-4"><p>List not found. If you created it elsewhere, sync first.</p><Link className="btn-outline mt-4" to="/lists">All lists</Link></div>;
  return <ListContents key={id} list={list} />;
}

function ListContents({ list }: { list: ExperienceList }) {
  const items = useListItems(list.id);
  const navigate = useNavigate();
  const [editingList, setEditingList] = useState(false);
  const [editingItem, setEditingItem] = useState<ListItem | 'new' | null>(null);
  const [query, setQuery] = useState('');
  const needle = query.trim().toLocaleLowerCase();
  const visible = items?.filter((i) => [i.title, i.notes, ...Object.values(i.details)].join(' ').toLocaleLowerCase().includes(needle));
  return (
    <div>
      <PageHeader title={list.name} actions={<button className="btn-outline" onClick={() => setEditingList(true)}>List settings</button>} />
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <Link className="btn-ghost -ml-2 w-fit px-2" to="/lists"><BackIcon /> All lists</Link>
        <p className="text-sm text-muted">{listKindLabel(list.kind)} · {items?.length ?? 0} entries</p>
        {list.description && <p className="whitespace-pre-wrap break-words text-fg-2">{list.description}</p>}
        <button className="btn-primary" onClick={() => setEditingItem('new')}><PlusIcon /> Add entry</button>
        {!!items?.length && <input className="input" type="search" aria-label="Search this list" placeholder="Search this list…" value={query} onChange={(e) => setQuery(e.target.value)} />}
        {!items ? <p>Loading…</p> : !items.length ? <p className="card p-6 text-fg-2">Nothing here yet. Add an experience and the details you want to remember.</p> : !visible?.length ? <p className="text-fg-2">No entries match your search.</p> : (
          <ul className="space-y-3">{visible.map((item) => (
            <li key={item.id} className="card p-4">
              <div className="flex items-start gap-3">
                <h2 className="min-w-0 flex-1 break-words text-lg font-bold">{item.title}</h2>
                <button className="btn-ghost shrink-0 px-3" aria-label={`Edit ${item.title}`} onClick={() => setEditingItem(item)}>Edit</button>
              </div>
              <div className="flex flex-wrap gap-x-3 text-sm text-muted">
                {item.experienced_on && <time dateTime={item.experienced_on}>{new Date(`${item.experienced_on}T12:00:00`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</time>}
                {item.rating !== null && <span aria-label={`Rated ${item.rating} out of 5`}>{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</span>}
              </div>
              <dl className="mt-2 space-y-1 text-sm">{LIST_FIELDS[list.kind].filter((f) => item.details[f.key]).map((f) => (
                <div key={f.key} className="break-words"><dt className="inline font-semibold">{f.label}: </dt><dd className="inline text-fg-2">{item.details[f.key]}</dd></div>
              ))}</dl>
              {item.notes && <p className="mt-3 whitespace-pre-wrap break-words text-fg-2">{item.notes}</p>}
              {item.url && /^https?:\/\//i.test(item.url) && <a className="mt-3 inline-block text-accent underline" href={item.url} target="_blank" rel="noopener noreferrer">Open link</a>}
            </li>
          ))}</ul>
        )}
      </div>
      {editingList && <ListEditor list={list} onClose={() => setEditingList(false)} onSaved={() => setEditingList(false)} onDeleted={() => navigate('/lists')} />}
      {editingItem && <ItemEditor list={list} item={editingItem === 'new' ? undefined : editingItem} onClose={() => setEditingItem(null)} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="field-label">{label}</span>{children}</label>;
}

function ListEditor({ list, onClose, onSaved, onDeleted }: { list?: ExperienceList; onClose: () => void; onSaved: (id: string) => void; onDeleted?: () => void }) {
  const [name, setName] = useState(list?.name ?? '');
  const [kind, setKind] = useState<ListKind>(list?.kind ?? 'general');
  const [description, setDescription] = useState(list?.description ?? '');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Please try again.'); }
    finally { setBusy(false); }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => onSaved(await saveList({ name, kind, description }, list?.id)));
  };
  return <Sheet title={list ? 'List settings' : 'New list'} onClose={() => { if (!busy) onClose(); }}>
    <form className="space-y-4 p-4" onSubmit={submit}>
      <fieldset disabled={busy} className="space-y-4">
        <Field label="Name"><input className="input" required autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Games I’ve finished" /></Field>
        <Field label="Category"><select className="input" value={kind} disabled={!!list} onChange={(e) => setKind(e.target.value as ListKind)}>{LIST_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select></Field>
        {list && <p className="text-sm text-muted">The category stays fixed so entries keep their fields.</p>}
        <Field label="Description (optional)"><textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        {error && <p role="alert" className="text-danger">{error}</p>}
        <div className="flex gap-2"><button className="btn-primary" disabled={!name.trim()}>Save list</button><button type="button" className="btn-outline" onClick={onClose}>Cancel</button></div>
        {list && (!confirm ? <button type="button" className="btn-danger" onClick={() => setConfirm(true)}>Delete list</button> : <div className="space-y-2 border-t border-line pt-4">
          <p>Delete this list and all its entries?</p>
          <div className="flex gap-2"><button type="button" className="btn-danger" onClick={() => void run(async () => { await deleteList(list.id); onDeleted?.(); })}>Delete list and entries</button><button type="button" className="btn-outline" onClick={() => setConfirm(false)}>Keep list</button></div>
        </div>)}
      </fieldset>
    </form>
  </Sheet>;
}

function ItemEditor({ list, item, onClose }: { list: ExperienceList; item?: ListItem; onClose: () => void }) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [date, setDate] = useState(item?.experienced_on ?? '');
  const [rating, setRating] = useState(item?.rating?.toString() ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [url, setUrl] = useState(item?.url ?? '');
  const [details, setDetails] = useState(item?.details ?? {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setError('');
    try { await action(); onClose(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Please try again.'); }
    finally { setBusy(false); }
  };
  return <Sheet title={item ? 'Edit entry' : 'Add entry'} onClose={() => { if (!busy) onClose(); }}>
    <form className="space-y-4 p-4" onSubmit={(e) => { e.preventDefault(); void run(() => saveListItem(list.id, { title, experienced_on: date || null, rating: rating ? Number(rating) : null, notes, url, details }, item?.id)); }}>
      <fieldset disabled={busy} className="space-y-4">
        <Field label="Title"><input className="input" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label={`${list.kind === 'concerts' ? 'Date attended' : list.kind === 'general' ? 'Date' : 'Date finished'} (optional)`}><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        {LIST_FIELDS[list.kind].map((f) => <Field key={f.key} label={`${f.label} (optional)`}><input className="input" value={details[f.key] ?? ''} onChange={(e) => setDetails({ ...details, [f.key]: e.target.value })} /></Field>)}
        <Field label="Rating (optional)"><select className="input" value={rating} onChange={(e) => setRating(e.target.value)}><option value="">No rating</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} / 5</option>)}</select></Field>
        <Field label="Notes (optional)"><textarea className="input" rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What stood out? What do you want to remember?" /></Field>
        <Field label="Link (optional)"><input className="input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></Field>
        {error && <p role="alert" className="text-danger">{error}</p>}
        <div className="flex gap-2"><button className="btn-primary" disabled={!title.trim()}>Save entry</button><button type="button" className="btn-outline" onClick={onClose}>Cancel</button></div>
        {item && (!confirm ? <button type="button" className="btn-danger" onClick={() => setConfirm(true)}>Delete entry</button> : <div className="space-y-2 border-t border-line pt-4"><p>Delete “{item.title}”?</p><div className="flex gap-2"><button type="button" className="btn-danger" onClick={() => void run(() => deleteListItem(item.id))}>Delete entry</button><button type="button" className="btn-outline" onClick={() => setConfirm(false)}>Keep entry</button></div></div>)}
      </fieldset>
    </form>
  </Sheet>;
}
