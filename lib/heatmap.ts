export type HeatThresholds = {
  p5: number;
  p975: number;
  allowBottom: boolean;
};

/** Linear-interpolated percentile on an ascending sorted numeric array. */
export function percentileAt(sortedAsc: number[], pct: number): number {
  if (!sortedAsc.length) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0]!;
  const idx = (pct / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo]!;
  const t = idx - lo;
  return sortedAsc[lo]! * (1 - t) + sortedAsc[hi]! * t;
}

/**
 * Top 2.5% (≥ P97.5) emerald / Bottom 5% (≤ P5) rose when variance allows.
 * Matches DataTable heatmap rules.
 */
export function heatmapClassForValue(
  value: number,
  thresholds: HeatThresholds | undefined
): string {
  if (!thresholds) return "";
  if (value >= thresholds.p975) {
    return "bg-emerald-100/60 text-emerald-900 font-bold group-hover:bg-emerald-100/80";
  }
  if (thresholds.allowBottom && value <= thresholds.p5) {
    return "bg-rose-100/60 text-rose-900 font-semibold group-hover:bg-rose-100/80";
  }
  return "";
}

/** Build P5 / P97.5 thresholds from a raw value list (unsorted ok). */
export function buildHeatThresholds(
  values: number[]
): HeatThresholds | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const p5 = percentileAt(sorted, 5);
  const p975 = percentileAt(sorted, 97.5);
  const allZero = sorted.every((v) => v === 0);
  const allowBottom = !allZero && p975 > p5 && p5 > 0;
  return { p5, p975, allowBottom };
}
