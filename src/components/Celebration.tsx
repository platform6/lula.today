import { useEffect, useState, type CSSProperties } from 'react';
import { onTaskCompleted } from '../lib/celebrate';
import { CheckIcon } from './icons';

// A full-screen swish when a task is completed: slanted bars in the orange
// ramp sweep across and cover the whole screen at the peak, with a check mark
// popping in the center. Purely decorative: it never blocks touches and is
// skipped for reduced motion.

const RAMP = ['#ffb98a', '#ffa36b', '#ff8a4c', '#ff7a3a', '#ff6a2b', '#e8501e', '#c2410c'];
const COUNT = 12;

// Bars tile the full height with a little overlap so no gaps show mid-sweep.
const BARS = Array.from({ length: COUNT }, (_, i) => ({
  top: `${(i * 100) / COUNT - 2}%`,
  height: `calc(${100 / COUNT}% + 4%)`,
  color: RAMP[(i * 3) % RAMP.length],
  delay: (i % 4) * 30 + i * 6, // a slight ripple, tight enough that all bars cover the screen together
  duration: 900 + (i % 3) * 70,
}));

const LIFETIME_MS = 1500;

export function Celebration() {
  const [bursts, setBursts] = useState<number[]>([]);

  useEffect(
    () =>
      onTaskCompleted(() => {
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
        const id = Date.now() + Math.random();
        setBursts((b) => [...b.slice(-1), id]);
        setTimeout(() => setBursts((b) => b.filter((x) => x !== id)), LIFETIME_MS);
      }),
    [],
  );

  if (bursts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {bursts.map((id) => (
        <div key={id} className="absolute inset-0">
          {BARS.map((bar, i) => (
            <span
              key={i}
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
          ))}
          <span className="swish-check">
            <CheckIcon width={64} height={64} strokeWidth={3.5} />
          </span>
        </div>
      ))}
    </div>
  );
}
