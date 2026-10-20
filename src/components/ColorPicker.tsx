export const COLORS = ['#7c8cff', '#5ec4ff', '#4fd1a5', '#a3d65c', '#f5c451', '#f59e5b', '#f2667a', '#d47ce8', '#8b93a5'];

export function ColorPicker({ value, onChange }: { value: string | null; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          className={`h-7 w-7 rounded-full border-2 ${value === c ? 'border-fg' : 'border-transparent'}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={`Color ${c}`}
        />
      ))}
    </div>
  );
}
