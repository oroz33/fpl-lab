export type HeatThresholds = {
  p5: number;
  p975: number;
  allowBottom: boolean;
};

export type RankHeatThresholds = {
  mode: "rank";
  bestCutoff: number;
  worstCutoff: number;
  lowerIsBetter: boolean;
  allowBottom: boolean;
};

export type AnyHeatThresholds = HeatThresholds | RankHeatThresholds;

function isRankHeat(
  thresholds: AnyHeatThresholds
): thresholds is RankHeatThresholds {
  return "mode" in thresholds && thresholds.mode === "rank";
}

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

const BEST_CLASS =
  "bg-emerald-100/60 text-emerald-900 font-bold group-hover:bg-emerald-100/80";
const WORST_CLASS =
  "bg-rose-100/60 text-rose-900 font-semibold group-hover:bg-rose-100/80";

/**
 * Top 2.5% (≥ P97.5) emerald / Bottom 5% (≤ P5) rose when variance allows.
 * Also supports rank-based top/bottom-N thresholds from buildTopBottomHeat.
 */
export function heatmapClassForValue(
  value: number,
  thresholds: AnyHeatThresholds | undefined
): string {
  if (!thresholds) return "";
  if (isRankHeat(thresholds)) {
    const isBest = thresholds.lowerIsBetter
      ? value <= thresholds.bestCutoff
      : value >= thresholds.bestCutoff;
    if (isBest) return BEST_CLASS;
    const isWorst = thresholds.lowerIsBetter
      ? value >= thresholds.worstCutoff
      : value <= thresholds.worstCutoff;
    if (thresholds.allowBottom && isWorst) return WORST_CLASS;
    return "";
  }
  if (value >= thresholds.p975) return BEST_CLASS;
  if (thresholds.allowBottom && value <= thresholds.p5) return WORST_CLASS;
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

/** Favorites mode: 1–5 → top/bottom 1, 6–10 → 2, 11+ → 3. */
export function favoritesHeatmapTopN(count: number): number {
  if (count <= 5) return 1;
  if (count <= 10) return 2;
  return 3;
}

/**
 * Rank heat: N best → emerald, N worst → rose.
 * Tie rule: any value equal to the Nth cutoff is colored (may exceed N cells).
 */
export function buildTopBottomHeat(
  values: number[],
  opts: { n: number; lowerIsBetter?: boolean }
): RankHeatThresholds | undefined {
  if (!values.length) return undefined;
  const n = Math.max(1, Math.min(Math.floor(opts.n), values.length));
  const lowerIsBetter = Boolean(opts.lowerIsBetter);
  const goodFirst = [...values].sort((a, b) =>
    lowerIsBetter ? a - b : b - a
  );
  const bestCutoff = goodFirst[n - 1]!;
  const worstCutoff = goodFirst[goodFirst.length - n]!;
  const hasSpread = lowerIsBetter
    ? worstCutoff > bestCutoff
    : worstCutoff < bestCutoff;
  if (!hasSpread) return undefined;
  return {
    mode: "rank",
    bestCutoff,
    worstCutoff,
    lowerIsBetter,
    allowBottom: true,
  };
}
