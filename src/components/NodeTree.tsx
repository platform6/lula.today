import type { CSSProperties, ReactNode } from 'react';

// Realms drawn as a node graph rather than folders: a root node, a spine
// running down from it, and an elbow connector out to each child node.
//
// Geometry is explicit so lines meet node centers exactly: each row has a
// fixed height, `y` is the row's vertical center, and a child list is offset
// so its spine sits directly under its parent node's center.

const LINE = 'var(--line-strong)';

type NodeKind = 'root' | 'realm' | 'project';

export const NODE_SIZE = {
  root: 22,
  realm: 18,
  project: 12,
  compactRoot: 16,
  compactRealm: 14,
  compactProject: 10,
} as const;

export function TreeNode({ kind, color, compact = false }: { kind: NodeKind; color?: string | null; compact?: boolean }) {
  const c = color ?? LINE;
  if (kind === 'root') {
    const size = compact ? NODE_SIZE.compactRoot : NODE_SIZE.root;
    return (
      <span
        aria-hidden="true"
        className="grid shrink-0 place-items-center rounded-full border-[3px] border-accent bg-bg"
        style={{ width: size, height: size }}
      >
        <span className="rounded-full bg-accent" style={{ width: size / 3, height: size / 3 }} />
      </span>
    );
  }
  if (kind === 'realm') {
    const size = compact ? NODE_SIZE.compactRealm : NODE_SIZE.realm;
    return (
      <span
        aria-hidden="true"
        className="shrink-0 rounded-full"
        style={{
          width: size,
          height: size,
          background: c,
          boxShadow: compact ? `0 0 0 2px var(--bg), 0 0 0 3.5px ${c}` : `0 0 0 3px var(--bg), 0 0 0 5px ${c}`,
        }}
      />
    );
  }
  const size = compact ? NODE_SIZE.compactProject : NODE_SIZE.project;
  return (
    <span
      aria-hidden="true"
      className="shrink-0 rounded-full bg-bg"
      style={{ width: size, height: size, border: `${compact ? 2 : 2.5}px solid ${c}` }}
    />
  );
}

/** A child of a tree list: spine from the parent plus an elbow to this row's node. */
export function Branch({
  last,
  y,
  indent,
  color = LINE,
  children,
}: {
  last: boolean;
  /** Vertical center of this branch's row, in px. */
  y: number;
  /** Horizontal length of the elbow, in px. */
  indent: number;
  color?: string | null;
  children: ReactNode;
}) {
  const bg = color ?? LINE;
  return (
    <li className="relative" style={{ paddingLeft: indent }}>
      {/* the spine continues past this branch unless it is the last one */}
      <span aria-hidden="true" className="pointer-events-none absolute top-0 left-0 w-0.5" style={{ height: last ? y + 1 : '100%', background: bg }} />
      <span aria-hidden="true" className="pointer-events-none absolute left-0 h-0.5" style={{ top: y - 1, width: indent - 1, background: bg }} />
      {children}
    </li>
  );
}

/** Line from a node down to the bottom of its row, joining its children's spine. */
export function Stem({ x, y, color = LINE }: { x: number; y: number; color?: string | null }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute bottom-0 w-0.5"
      style={{ left: x - 1, top: y, background: color ?? LINE }}
    />
  );
}

/** A nested list whose spine sits under a parent node centered at `x`. */
export function Children({ x, children, style }: { x: number; children: ReactNode; style?: CSSProperties }) {
  return <ul style={{ marginLeft: x - 1, ...style }}>{children}</ul>;
}
