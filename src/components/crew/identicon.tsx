/**
 * Identicon — abstract geometric avatar (UI-DESIGN.md §6): a 5×5 mirrored
 * grid seeded by the user id, drawn from the brand palette as pure SVG.
 * No stock faces, no external avatar service.
 */

const PALETTE = ["#4F46E5", "#18181B", "#71717A", "#A1A1AA", "#D4D4D8"];

/** Deterministic 32-bit hash of a string (FNV-1a). */
function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function Identicon({
  seed,
  className,
  title,
}: {
  seed: string;
  className?: string;
  title?: string;
}) {
  const h = hash(seed);
  const color = PALETTE[h % PALETTE.length];
  // 5×5 mirrored pattern: 3 columns drawn, mirrored to 5.
  const cells: boolean[] = [];
  let bits = h >> 3;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      cells.push(bits % 2 === 0);
      bits = (bits * 1103515245 + 12345) >>> 0;
    }
  }

  const rects: { x: number; y: number }[] = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      if (cells[row * 3 + col]) {
        rects.push({ x: col, y: row });
        if (col < 2) rects.push({ x: 4 - col, y: row });
      }
    }
  }

  return (
    <svg
      viewBox="0 0 5 5"
      className={className}
      role="img"
      aria-label={title ?? "Avatar"}
      shapeRendering="crispEdges"
    >
      <rect width="5" height="5" fill="#F4F4F5" />
      {rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width="1" height="1" fill={color} />
      ))}
    </svg>
  );
}
