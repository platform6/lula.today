import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { moveTaskToRealm } from '../db/actions';
import { useAreas, useSettings } from '../db/hooks';
import type { Area } from '../db/types';
import { onNotice } from '../lib/celebrate';
import { remember } from '../lib/stored';
import type { InboxDragData, RealmDropData } from './dragData';
import { PlusIcon } from './icons';
import { Celebration } from './Celebration';
import { ConfirmCompleteProvider } from './ConfirmComplete';
import { AddMenu } from './AddMenu';
import { QuickAdd } from './QuickAdd';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { TaskSheet } from './TaskSheet';
import { TimerBar } from './Timer';
import { useOpenTask } from './useOpenTask';
import { RealmExpansionProvider } from './RealmExpansion';

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));


// Drop on whatever is under the finger/pointer; fall back to overlap.
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

export function Layout() {
  const [quickAdd, setQuickAdd] = useState(false);
  const [addMenu, setAddMenu] = useState(false);
  const [params] = useSearchParams();
  const taskId = params.get('task');
  const openTask = useOpenTask();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onListsPage = pathname.startsWith('/lists');
  // The Time page shows the running timer itself, so the docked bar is left off there.
  const onTimePage = pathname === '/';
  const theme = useSettings()?.theme;
  const [dragging, setDragging] = useState<InboxDragData | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Inbox rows start dragging on a short mouse move or a press-and-hold on touch,
  // so taps and scrolling keep working.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  useEffect(() => {
    if (!theme) return;
    document.documentElement.dataset.theme = theme;
    // The installed app's status bar takes this color.
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f7f7f5' : '#111316');
    remember('lula.theme', theme); // read by index.html to avoid a flash on launch
  }, [theme]);

  // Desktop shortcuts: n = new task, / = search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (e.key === 'n') {
        e.preventDefault();
        setQuickAdd(true);
      } else if (e.key === '/') {
        e.preventDefault();
        navigate('/search');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const showToast = (text: string) => {
    clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  // e.g. "Done · next one Wed, Oct 28" when a recurring task moves on
  useEffect(() => onNotice(showToast), []);

  const onDragStart = ({ active }: DragStartEvent) => {
    const data = active.data.current as InboxDragData | undefined;
    if (data?.type === 'inbox-task') setDragging(data);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    const task = active.data.current as InboxDragData | undefined;
    const realm = over?.data.current as RealmDropData | undefined;
    if (task?.type !== 'inbox-task' || realm?.type !== 'realm') return;
    void moveTaskToRealm(task.id, realm.areaId).then(() => showToast(`Moved to ${realm.name}`));
  };

  return (
    <RealmExpansionProvider>
    <ConfirmCompleteProvider>
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={onDragStart}
        onDragCancel={() => setDragging(null)}
        onDragEnd={onDragEnd}
      >
        <div className="flex h-full">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <main className="pt-safe min-h-0 flex-1 overflow-y-auto pb-56 md:pb-8">
              <Outlet />
            </main>
            {!onTimePage && <TimerBar variant="dock" />}
            <BottomNav />
          </div>

          {!dragging && !onListsPage && (
            <button
              className={`fixed right-4 ${onTimePage ? 'bottom-[calc(5.25rem+var(--tab-safe))]' : 'bottom-[calc(8.875rem+var(--tab-safe))]'} z-30 grid h-16 w-16 place-items-center rounded-full bg-accent text-accent-fg shadow-xl shadow-black/40 md:right-6 md:bottom-6`}
              onClick={() => setAddMenu(true)}
              aria-label="Add time or a task"
            >
              <PlusIcon width={32} height={32} strokeWidth={2.75} />
            </button>
          )}

          {dragging && <RealmDropBar />}

          {addMenu && (
            <AddMenu
              onClose={() => setAddMenu(false)}
              onNewTask={() => {
                setAddMenu(false);
                setQuickAdd(true);
              }}
            />
          )}
          {quickAdd && (
            <QuickAdd
              onClose={() => setQuickAdd(false)}
              onCreated={(id, openDetails) => {
                setQuickAdd(false);
                if (openDetails) openTask(id);
              }}
            />
          )}
          {taskId && <TaskSheet id={taskId} onClose={() => openTask(null)} />}
          <Celebration />

          {toast && (
            <div
              role="status"
              className="fixed top-[calc(env(safe-area-inset-top)+4.5rem)] left-1/2 z-50 -translate-x-1/2 rounded-md border-2 border-accent bg-surface px-5 py-3 text-base font-bold shadow-2xl"
            >
              {toast}
            </div>
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          {dragging && (
            <div className="card max-w-xs border-2 border-accent px-4 py-3 text-base font-semibold shadow-2xl">
              {dragging.title}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </ConfirmCompleteProvider>
    </RealmExpansionProvider>
  );
}

/** Appears while dragging an Inbox task: one large drop target per realm. */
function RealmDropBar() {
  const areas = useAreas() ?? [];
  return (
    <div className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t-2 border-accent bg-surface p-3 shadow-2xl md:left-[var(--side-w,18rem)]">
      <p className="mb-2 text-base font-bold">Drop on a realm</p>
      {areas.length === 0 ? (
        <p className="text-base text-fg-2">Create a realm first (Realms tab).</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {areas.map((a) => (
            <RealmDropTarget key={a.id} area={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function RealmDropTarget({ area }: { area: Area }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `realm-bar:${area.id}`,
    data: { type: 'realm', areaId: area.id, name: area.name } satisfies RealmDropData,
  });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-16 items-center gap-3 rounded-md border-2 border-l-8 px-3 text-lg font-bold transition-colors ${isOver ? 'border-accent bg-accent/20' : 'border-line-strong bg-surface-2'}`}
      style={{ borderLeftColor: area.color ?? 'var(--line-strong)' }}
    >
      <span className="min-w-0 truncate">{area.name}</span>
    </div>
  );
}
