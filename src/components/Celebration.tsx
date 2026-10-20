import { useEffect, useState, type CSSProperties } from 'react';
import { onTaskCompleted } from '../lib/celebrate';

// A swish of orange bars across the screen when a task is completed.
// Purely decorative: it never blocks touches and is skipped for reduced motion.

const BARS: { top: string; height: number; color: string; delay: number; duration: number }[] = [
  { top: '22%', height: 14, color: '#ffb98a', delay: 0, duration: 760 },
  { top: '30%', height: 34, color: '#ff6a2b', delay: 40, duration: 820 },
  { top: '39%', height: 20, color: '#e8501e', delay: 90, duration: 780 },
  { top: '46%', height: 46, color: '#ff8a4c', delay: 20, duration: 880 },
  { top: '56%', height: 18, color: '#c2410c', delay: 130, duration: 800 },
  { top: '62%', height: 28, color: '#ffa36b', delay: 70, duration: 840 },
  { top: '71%', height: 12, color: '#ff7a3a', delay: 160, duration: 760 },
];

const LIFETIME_MS = 1200;

export function Celebration() {
  const [bursts, setBursts] = useState<number[]>([]);

  useEffect(
    () =>
      onTaskCompleted(() => {
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
        const id = Date.now() + Math.random();
        setBursts((b) => [...b.slice(-2), id]);
        setTimeout(() => setBursts((b) => b.filter((x) => x !== id)), LIFETIME_MS);
      }),
    [],
  );

  if (bursts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {bursts.map((id) =>
        BARS.map((bar, i) => (
          <span
            key={`${id}-${i}`}
            className="swish-bar"
            style={
              {
                top: bar.top,
                height: bar.height,
                '--bar-color': bar.color,
                animationDelay: `${bar.delay}ms`,
                animationDuration: `${bar.duration}ms`,
              } as CSSProperties
            }
          />
        )),
      )}
    </div>
  );
}
