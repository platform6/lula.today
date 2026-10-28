export function CountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="grid min-w-6 place-items-center rounded-full bg-accent px-1.5 text-xs font-bold text-accent-fg">
      {count > 99 ? '99+' : count}
    </span>
  );
}
