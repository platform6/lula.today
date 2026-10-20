import { useRegisterSW } from 'virtual:pwa-register/react';

const CHECK_EVERY_MS = 5 * 60 * 1000;

/**
 * Offers a new deploy once it has downloaded. The installed iOS app is usually
 * resumed rather than relaunched, so also check whenever it comes back to the
 * foreground and every few minutes while open. Reloading is left to a tap so
 * nothing being typed is lost.
 */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine) void registration.update();
      };
      setInterval(check, CHECK_EVERY_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });

  if (!needRefresh) return null;
  return (
    <button
      className="fixed top-[calc(env(safe-area-inset-top)+0.75rem)] left-1/2 z-50 flex min-h-11 -translate-x-1/2 items-center gap-2 rounded-md border-2 border-accent bg-surface px-4 text-sm font-bold whitespace-nowrap shadow-2xl"
      onClick={() => void updateServiceWorker(true)}
    >
      Update available
      <span className="text-accent">Tap to reload</span>
    </button>
  );
}
