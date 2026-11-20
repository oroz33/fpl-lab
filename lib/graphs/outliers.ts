export interface ScatterPoint {
  id: string;
  name: string;
  team?: string;
  x: number;
  y: number;
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

/** Label top outliers by distance from sample median in normalized [0,1] space. */
export function selectOutlierIds(
  points: ScatterPoint[],
  entity: "players" | "teams",
  maxLabels = 8
): Set<string> {
  if (points.length === 0) return new Set();

  const labelCount =
    entity === "teams" && points.length <= 20
      ? points.length
      : Math.min(maxLabels, points.length);

  if (labelCount >= points.length) {
    return new Set(points.map((p) => p.id));
  }

  const xs = points.map((p) => p.x).sort((a, b) => a - b);
  const ys = points.map((p) => p.y).sort((a, b) => a - b);
  const medX = median(xs);
  const medY = median(ys);

  const minX = xs[0]!;
  const maxX = xs[xs.length - 1]!;
  const minY = ys[0]!;
  const maxY = ys[ys.length - 1]!;
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const ranked = points
    .map((p) => {
      const nx = (p.x - medX) / rangeX;
      const ny = (p.y - medY) / rangeY;
      return { id: p.id, dist: Math.hypot(nx, ny) };
    })
    .sort((a, b) => b.dist - a.dist);

  return new Set(ranked.slice(0, labelCount).map((r) => r.id));
}

export function numericValue(row: Record<string, unknown>, key: string): number | null {
  const v = row[key];
  if (v == null) return null;
  if (typeof v !== "number" || Number.isNaN(v)) return null;
  return v;
}
