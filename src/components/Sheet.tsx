import { useEffect, type ReactNode } from 'react';
import { XIcon } from './icons';

/** Bottom sheet on phones, right-hand panel on wider screens. */
export function Sheet({
  title,
  onClose,
  children,
  side = 'auto',
}: {
  title?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  side?: 'auto' | 'center';
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const panel =
    side === 'center'
      ? 'inset-x-0 bottom-0 max-h-[90dvh] rounded-t-2xl md:inset-x-auto md:top-24 md:bottom-auto md:left-1/2 md:w-[32rem] md:-translate-x-1/2 md:rounded-2xl'
      : 'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl md:inset-y-0 md:right-0 md:left-auto md:max-h-none md:w-[30rem] md:rounded-none md:border-l';

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={`absolute flex flex-col border-line bg-surface shadow-2xl ${panel}`}>
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <div className="min-w-0 flex-1 font-semibold">{title}</div>
          <button className="btn-ghost -mr-2 px-2" onClick={onClose} aria-label="Close">
            <XIcon />
          </button>
        </div>
        <div className="pb-safe flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
