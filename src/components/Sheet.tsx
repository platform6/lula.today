import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { XIcon } from './icons';

/**
 * Bottom sheet on phones. On wider screens: a right-hand panel ('auto'), a small
 * dialog near the top ('center'), or a large centered window ('modal').
 * A modal dialog: Tab stays inside it, and focus goes back where it was on close.
 * On phones the sheet rides above the on-screen keyboard instead of behind it.
 */
export function Sheet({
  title,
  onClose,
  children,
  footer,
  side = 'auto',
  wide = false,
  fill = false,
}: {
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Pinned below the scrolling content (e.g. a Save button). */
  footer?: ReactNode;
  side?: 'auto' | 'center' | 'modal';
  /** A modal that uses most of a desktop screen (lg and up), e.g. a task with long notes. */
  wide?: boolean;
  /** On phones, take the full height from the start, so a list filtered by typing doesn't shrink the sheet and move its search box. */
  fill?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const keyboard = useKeyboardInset();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus();
    return () => opener?.focus?.();
  }, []);

  function trapTab(e: React.KeyboardEvent) {
    // A sheet opened inside another handles its own Tab.
    if (e.key !== 'Tab' || e.defaultPrevented || !panelRef.current) return;
    const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const inside = panelRef.current.contains(document.activeElement) && document.activeElement !== panelRef.current;
    if (e.shiftKey && (!inside || document.activeElement === first)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
      e.preventDefault();
      first.focus();
    }
  }

  const panel =
    side === 'center'
      ? `inset-x-0 bottom-[var(--kb)] max-h-[calc(90dvh-var(--kb))] rounded-t-2xl md:inset-x-auto md:top-24 md:bottom-auto md:left-1/2 md:max-h-[90dvh] md:w-[32rem] md:-translate-x-1/2 md:rounded-2xl${fill ? ' h-[calc(90dvh-var(--kb))] md:h-auto' : ''}`
      : side === 'modal'
        ? `inset-x-0 bottom-[var(--kb)] max-h-[calc(92dvh-var(--kb))] rounded-t-2xl md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:max-h-[88dvh] md:w-[40rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl${wide ? ' lg:max-h-[92dvh] lg:w-[min(72rem,94vw)]' : ''}${fill ? ' h-[calc(92dvh-var(--kb))] md:h-auto' : ''}`
        : `inset-x-0 bottom-[var(--kb)] max-h-[calc(92dvh-var(--kb))] rounded-t-2xl md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[30rem] md:rounded-none md:border-l${fill ? ' h-[calc(92dvh-var(--kb))] md:h-auto' : ''}`;

  return (
    <div className="fixed inset-0 z-40" onKeyDown={trapTab}>
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        style={{ '--kb': `${keyboard}px` } as CSSProperties}
        className={`absolute flex flex-col border-2 border-line-strong bg-surface shadow-2xl outline-none ${panel}`}
      >
        <div className="flex min-h-16 items-center gap-2 border-b border-line px-4 py-2">
          <div id={titleId} className="min-w-0 flex-1 text-lg font-bold">{title}</div>
          <button className="btn-ghost -mr-2 px-2" onClick={onClose} aria-label="Close">
            <XIcon width={28} height={28} />
          </button>
        </div>
        <div className={`flex-1 overflow-y-auto ${footer ? '' : 'pb-safe'}`}>{children}</div>
        {footer && <div className="pb-safe flex justify-center border-t border-line px-4 pt-2">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * How much of the bottom of the window an on-screen keyboard covers, in px (0 with
 * none). Browsers that shrink only the visual viewport for the keyboard (iOS Safari,
 * Chrome on Android) leave fixed elements behind it; this measures the difference.
 */
function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const measure = () => {
      // Zoomed in, the visual viewport is smaller on purpose.
      const covered = vv.scale > 1.01 ? 0 : window.innerHeight - vv.height - vv.offsetTop;
      // Small differences are toolbars and rounding, not a keyboard.
      setInset(covered > 80 ? Math.round(covered) : 0);
    };
    measure();
    vv.addEventListener('resize', measure);
    vv.addEventListener('scroll', measure);
    return () => {
      vv.removeEventListener('resize', measure);
      vv.removeEventListener('scroll', measure);
    };
  }, []);
  return inset;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
