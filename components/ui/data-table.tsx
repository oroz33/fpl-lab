"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import packageJson from "@/package.json";
import { ColumnFilterPopover } from "@/components/ui/column-filter-popover";
import {
  FDR_COLORS,
  FixtureHorizonProvider,
  syncFixtureHorizon,
  type FixtureHorizon,
} from "@/components/ui/fixture-badges";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { metricDescription } from "@/lib/constants/metrics";
import { cn, formatNum, round } from "@/lib/utils";

export type ColumnDef<T> = {
  key: string;
  label: string;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  sticky?: boolean;
  /** Width (px) for the sticky identity column. Default 195 (Player). */
  stickyWidth?: number;
  stickyOffset?: number;
  render?: (row: T) => ReactNode;
  getValue?: (row: T) => string | number | null | undefined;
  numeric?: boolean;
  /** When false, skip percentile heatmap (e.g. Apps/Mins). Default true for numeric cols. */
  heatmap?: boolean;
  digits?: number;
  filterable?: boolean;
  /** When true, numeric filter keeps rows with value ≤ threshold (e.g. Avg FDR). */
  lowerIsBetter?: boolean;
};

export type ActiveColumnFilter = {
  key: string;
  label: string;
  value: string;
};

type SortState = { key: string; dir: "asc" | "desc" } | null;
type PageSize = 25 | 50 | 100;

const PAGE_SIZE_OPTIONS: PageSize[] = [25, 50, 100];

function cellValue<T>(row: T, col: ColumnDef<T>): string | number | null | undefined {
  if (col.getValue) return col.getValue(row);
  return (row as Record<string, unknown>)[col.key] as string | number | null | undefined;
}

function columnAlign<T>(col: ColumnDef<T>): "left" | "right" | "center" {
  if (col.align) return col.align;
  if (col.numeric) return "center";
  return "left";
}

function isFixturesCol<T>(col: ColumnDef<T>): boolean {
  return col.key === "nextFixtures";
}

function isIdentityStickyCol<T>(col: ColumnDef<T>): boolean {
  return col.key === "name";
}

function isStickyCol<T>(col: ColumnDef<T>, nameOnly: boolean): boolean {
  if (nameOnly) return isIdentityStickyCol(col);
  return Boolean(col.sticky) || col.key === "name" || isFixturesCol(col);
}

function isAvgFdrCol<T>(col: ColumnDef<T>): boolean {
  return col.key === "avgFdr";
}

const DEFAULT_IDENTITY_WIDTH = 195;
const MOBILE_NAME_WIDTH = 130;
const FIXTURES_WIDTH_3 = 168;
const FIXTURES_WIDTH_5 = 320;
const MD_UP_QUERY = "(min-width: 768px)";

function useIsMdUp(): boolean {
  const [isMdUp, setIsMdUp] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(MD_UP_QUERY).matches : true
  );

  useEffect(() => {
    const mq = window.matchMedia(MD_UP_QUERY);
    const onChange = () => setIsMdUp(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isMdUp;
}

type StickyLayout = {
  left: number;
  width: number;
  isLast: boolean;
};

function buildStickyLayout<T>(
  columns: ColumnDef<T>[],
  horizon: FixtureHorizon,
  nameOnly: boolean
): Map<string, StickyLayout> {
  const fixturesWidth = horizon === 5 ? FIXTURES_WIDTH_5 : FIXTURES_WIDTH_3;
  const layout = new Map<string, StickyLayout>();
  let left = 0;
  const stickyCols = columns.filter((col) => isStickyCol(col, nameOnly));

  stickyCols.forEach((col, index) => {
    const width = nameOnly
      ? MOBILE_NAME_WIDTH
      : isFixturesCol(col)
        ? fixturesWidth
        : (col.stickyWidth ?? DEFAULT_IDENTITY_WIDTH);
    layout.set(col.key, {
      left,
      width,
      isLast: index === stickyCols.length - 1,
    });
    left += width;
  });

  return layout;
}

function rowPassesFilters<T>(
  row: T,
  columns: ColumnDef<T>[],
  filters: Record<string, string>
): boolean {
  for (const col of columns) {
    const rawFilter = filters[col.key];
    if (rawFilter === undefined || rawFilter.trim() === "") continue;

    const value = cellValue(row, col);

    if (col.numeric) {
      const threshold = Number(rawFilter);
      if (!Number.isFinite(threshold)) continue;
      if (value === null || value === undefined || typeof value !== "number") return false;
      if (col.lowerIsBetter) {
        if (value > threshold) return false;
      } else if (value < threshold) {
        return false;
      }
    } else {
      if (value === null || value === undefined) return false;
      if (!String(value).toLowerCase().includes(rawFilter.trim().toLowerCase())) return false;
    }
  }
  return true;
}

type HeatThresholds = { p5: number; p975: number; allowBottom: boolean };

function percentileAt(sortedAsc: number[], pct: number): number {
  if (!sortedAsc.length) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0]!;
  const idx = (pct / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo]!;
  const t = idx - lo;
  return sortedAsc[lo]! * (1 - t) + sortedAsc[hi]! * t;
}

function heatmapClassForValue(
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

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  emptyMessage = "No rows match the current filters.",
  onFiltersChange,
  horizon: horizonProp,
  onHorizonChange,
}: {
  columns: ColumnDef<T>[];
  rows: T[];
  emptyMessage?: string;
  onFiltersChange?: (filters: ActiveColumnFilter[]) => void;
  /** When set with onHorizonChange, horizon is controlled by the parent (e.g. Dashboard). */
  horizon?: FixtureHorizon;
  onHorizonChange?: (horizon: FixtureHorizon) => void;
}) {
  const [sort, setSort] = useState<SortState>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const [page, setPage] = useState(1);
  const [internalHorizon, setInternalHorizon] = useState<FixtureHorizon>(3);
  const isMdUp = useIsMdUp();
  const controlled = horizonProp !== undefined && onHorizonChange !== undefined;
  const horizon = controlled ? horizonProp : internalHorizon;
  const setHorizon = controlled ? onHorizonChange : setInternalHorizon;

  syncFixtureHorizon(horizon);

  const filteredRows = useMemo(
    () => rows.filter((row) => rowPassesFilters(row, columns, filters)),
    [rows, columns, filters, horizon]
  );

  const sorted = useMemo(() => {
    if (!sort) return filteredRows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filteredRows;
    const copy = [...filteredRows];
    copy.sort((a, b) => {
      const av = cellValue(a, col);
      const bv = cellValue(b, col);
      const an = av === null || av === undefined ? -Infinity : av;
      const bn = bv === null || bv === undefined ? -Infinity : bv;
      if (typeof an === "number" && typeof bn === "number") {
        return sort.dir === "asc" ? an - bn : bn - an;
      }
      return sort.dir === "asc"
        ? String(an).localeCompare(String(bn))
        : String(bn).localeCompare(String(an));
    });
    return copy;
  }, [filteredRows, sort, columns, horizon]);

  const columnHeatThresholds = useMemo(() => {
    const map = new Map<string, HeatThresholds>();
    for (const col of columns) {
      if (!col.numeric || col.heatmap === false) continue;
      const values: number[] = [];
      for (const row of sorted) {
        const v = cellValue(row, col);
        if (typeof v === "number" && Number.isFinite(v)) values.push(v);
      }
      if (!values.length) continue;
      values.sort((a, b) => a - b);
      const p5 = percentileAt(values, 5);
      const p975 = percentileAt(values, 97.5);
      const allZero = values.every((v) => v === 0);
      const allowBottom = !allZero && p975 > p5 && p5 > 0;
      map.set(col.key, { p5, p975, allowBottom });
    }
    return map;
  }, [columns, sorted]);

  const columnValues = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const col of columns) {
      if (!col.numeric) continue;
      const vals: number[] = [];
      for (const row of rows) {
        const v = cellValue(row, col);
        if (typeof v === "number" && Number.isFinite(v)) vals.push(v);
      }
      map.set(col.key, vals);
    }
    return map;
  }, [columns, rows, horizon]);

  const total = sorted.length;
  const pageCount = total === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(1);
  }, [filters, sort, pageSize, rows]);

  useEffect(() => {
    setPage((p) => Math.min(p, pageCount));
  }, [pageCount]);

  useEffect(() => {
    if (!onFiltersChange) return;
    const active: ActiveColumnFilter[] = [];
    for (const col of columns) {
      const value = filters[col.key];
      if (value !== undefined && value.trim() !== "") {
        active.push({
          key: col.key,
          label: col.numeric
            ? `${col.label} ${col.lowerIsBetter ? "≤" : "≥"} ${value}`
            : `${col.label}: ${value}`,
          value,
        });
      }
    }
    onFiltersChange(active);
  }, [filters, columns, onFiltersChange]);

  const start = total === 0 ? 0 : (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const visibleRows = sorted.slice(start, end);

  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "desc" };
      if (prev.dir === "desc") return { key, dir: "asc" };
      return null;
    });
  }

  const stickyLayout = useMemo(
    () => buildStickyLayout(columns, horizon, !isMdUp),
    [columns, horizon, isMdUp]
  );

  /** Hide non-sticky columns that slide under the sticky edge (avoids orphan filter icons). */
  useEffect(() => {
    const scroller = document.querySelector(
      "[data-table-scroll]"
    ) as HTMLElement | null;
    if (!scroller) return;

    const lastStickyKey = [...stickyLayout.entries()].find(([, v]) => v.isLast)?.[0];

    const syncCoveredColumns = () => {
      const stickyEndEl = lastStickyKey
        ? (scroller.querySelector(
            `th[data-col-key="${lastStickyKey}"]`
          ) as HTMLElement | null)
        : null;
      const stickyEnd = stickyEndEl?.getBoundingClientRect().right ?? 0;

      scroller.querySelectorAll<HTMLElement>("[data-col-key]").forEach((el) => {
        const key = el.dataset.colKey;
        if (!key || stickyLayout.has(key)) {
          el.style.visibility = "";
          return;
        }
        const r = el.getBoundingClientRect();
        el.style.visibility = r.left < stickyEnd - 1 ? "hidden" : "";
      });
    };

    syncCoveredColumns();
    scroller.addEventListener("scroll", syncCoveredColumns, { passive: true });
    window.addEventListener("resize", syncCoveredColumns);
    return () => {
      scroller.removeEventListener("scroll", syncCoveredColumns);
      window.removeEventListener("resize", syncCoveredColumns);
      scroller.querySelectorAll<HTMLElement>("[data-col-key]").forEach((el) => {
        el.style.visibility = "";
      });
    };
  }, [stickyLayout, horizon, columns, rows]);

  return (
    <FixtureHorizonProvider horizon={horizon} setHorizon={setHorizon}>
    <TooltipProvider delayDuration={180}>
    <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest shadow-[0_4px_20px_rgba(11,28,48,0.06)]">
      <div className="relative w-full overflow-x-auto" data-table-scroll>
        <table className="w-full border-collapse text-left select-text">
          <thead>
            <tr className="h-table-row-h bg-primary text-[11px] font-semibold tracking-[0.02em] text-on-primary uppercase">
              {columns.map((col) => {
                const active = sort?.key === col.key;
                const align = columnAlign(col);
                const numeric = Boolean(col.numeric);
                const fixtures = isFixturesCol(col);
                const sticky = stickyLayout.get(col.key);
                const avgFdr = isAvgFdrCol(col);
                const filterable = col.filterable !== false && numeric;
                const description = metricDescription(col.label);
                const labelClassName = cn(
                  filters[col.key] &&
                    "font-bold underline decoration-tertiary-fixed decoration-2 underline-offset-4"
                );

                return (
                  <th
                    key={col.key}
                    data-col-key={col.key}
                    scope="col"
                    title={
                      fixtures
                        ? `Fixture Horizon: ${horizon} Gameweeks`
                        : undefined
                    }
                    className={cn(
                      "whitespace-nowrap px-1.5 py-cell-py md:px-space-sm",
                      fixtures && "hidden md:table-cell",
                      sticky &&
                        cn(
                          "sticky max-w-[130px] bg-primary px-1.5 md:max-w-none md:px-space-md",
                          sticky.isLast ? "z-[32]" : "z-30",
                          fixtures && "overflow-hidden",
                          sticky.isLast &&
                            "shadow-[6px_0_12px_-3px_rgba(0,0,0,0.35)]"
                        ),
                      numeric && !avgFdr && "min-w-[48px] text-center md:min-w-[55px]",
                      avgFdr && "w-[84px] min-w-[84px] shrink-0 text-center",
                      filters[col.key] && "bg-primary-container text-tertiary-fixed"
                    )}
                    style={
                      sticky
                        ? {
                            left: sticky.left,
                            minWidth: sticky.width,
                            maxWidth: sticky.width,
                            width: sticky.width,
                          }
                        : undefined
                    }
                    onClick={() =>
                      !fixtures && col.sortable !== false && toggleSort(col.key)
                    }
                  >
                    {fixtures ? (
                      <div className="flex flex-nowrap items-center justify-start gap-1.5 whitespace-nowrap normal-case">
                        <div className="flex shrink-0 flex-nowrap items-center gap-1.5">
                          <span className="text-[11px] font-semibold tracking-wider text-on-primary uppercase">
                            Next
                          </span>
                          <div className="inline-flex shrink-0 items-center gap-0.5 rounded border border-on-primary/10 bg-surface-container-low/20 p-0.5">
                            {([3, 5] as const).map((n) => {
                              const isActive = horizon === n;
                              return (
                                <button
                                  key={n}
                                  type="button"
                                  title={
                                    isActive
                                      ? `Active: Next ${n} Gameweeks`
                                      : `Switch to Next ${n} Gameweeks`
                                  }
                                  className={cn(
                                    "rounded px-1.5 py-0.5 font-data-mono text-[10px] leading-tight transition-all",
                                    isActive
                                      ? "bg-surface-container-lowest font-bold text-primary shadow-sm"
                                      : "font-medium text-on-primary/60 hover:text-on-primary"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setHorizon(n);
                                  }}
                                >
                                  {n}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <CalendarDays className="h-[13px] w-[13px] shrink-0 text-on-primary/50" />
                      </div>
                    ) : (
                      <div
                        className={cn(
                          "flex items-center gap-0.5",
                          align === "right"
                            ? "justify-end"
                            : align === "center" || numeric
                              ? "justify-center"
                              : "justify-between"
                        )}
                      >
                        {description ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className={labelClassName}>{col.label}</span>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="z-[100] rounded-md border border-white/10 bg-slate-900/95 px-2 py-1 text-[11px] text-white shadow-sm"
                            >
                              {description}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className={labelClassName}>{col.label}</span>
                        )}
                        <span className="inline-flex items-center gap-0.5">
                          {col.sortable !== false &&
                            (active ? (
                              sort?.dir === "asc" ? (
                                <ArrowUp className="h-3.5 w-3.5 shrink-0 opacity-90" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5 shrink-0 opacity-90" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" />
                            ))}
                          {filterable && (
                            <ColumnFilterPopover
                              label={col.label}
                              values={columnValues.get(col.key) ?? []}
                              applied={filters[col.key]}
                              active={Boolean(filters[col.key])}
                              lowerIsBetter={Boolean(col.lowerIsBetter)}
                              digits={col.digits ?? 2}
                              onApply={(threshold) => {
                                const precision = col.digits ?? 2;
                                setFilters((prev) => ({
                                  ...prev,
                                  [col.key]: String(
                                    round(threshold, precision)
                                  ),
                                }));
                              }}
                              onReset={() => {
                                setFilters((prev) => {
                                  const next = { ...prev };
                                  delete next[col.key];
                                  return next;
                                });
                              }}
                            />
                          )}
                        </span>
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container font-data-mono text-[12px] leading-4">
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center font-sans text-on-surface-variant"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr
                  key={row.id}
                  className="group transition-colors hover:bg-surface-container-high/40"
                >
                  {columns.map((col) => {
                    const raw = cellValue(row, col);
                    let content: ReactNode;
                    if (col.render) content = col.render(row);
                    else if (col.numeric) content = formatNum(raw as number, col.digits ?? 2);
                    else content = raw === null || raw === undefined ? "—" : String(raw);

                    const numeric = Boolean(col.numeric);
                    const sticky = stickyLayout.get(col.key);
                    const avgFdr = isAvgFdrCol(col);
                    const heat =
                      numeric && col.heatmap !== false && typeof raw === "number"
                        ? heatmapClassForValue(raw, columnHeatThresholds.get(col.key))
                        : "";

                    return (
                      <td
                        key={col.key}
                        data-col-key={col.key}
                        className={cn(
                          "whitespace-nowrap px-1.5 py-cell-py text-on-surface md:px-space-sm",
                          isFixturesCol(col) && "hidden md:table-cell",
                          sticky &&
                            cn(
                              "sticky max-w-[130px] truncate bg-surface-container-lowest px-1.5 group-hover:bg-surface-container-low md:max-w-none md:px-space-md",
                              sticky.isLast ? "z-[22]" : "z-20",
                              isFixturesCol(col) && "overflow-hidden",
                              sticky.isLast &&
                                "shadow-[6px_0_12px_-3px_rgba(0,0,0,0.08)]"
                            ),
                          numeric && "text-center tabular-nums",
                          avgFdr && "w-[84px] min-w-[84px] shrink-0",
                          !numeric && !sticky && "font-sans text-[12px] text-on-surface-variant",
                          heat
                        )}
                        style={
                          sticky
                            ? {
                                left: sticky.left,
                                minWidth: sticky.width,
                                maxWidth: sticky.width,
                                width: sticky.width,
                              }
                            : undefined
                        }
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-center justify-between gap-space-md bg-surface-container-low px-space-lg py-space-md sm:flex-row">
        <div className="flex items-center gap-space-lg">
          <div className="flex items-center gap-space-xs text-[10px] font-medium text-on-surface-variant">
            <span className="font-semibold tracking-wider uppercase">
              Fixture Difficulty (FDR):
            </span>
            <div className="ml-1 flex items-center gap-1">
              {([1, 2, 3, 4, 5] as const).map((score) => (
                <span
                  key={score}
                  className={cn(
                    "flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-black/10 font-data-mono text-[9px] font-bold tabular-nums",
                    FDR_COLORS[score]
                  )}
                >
                  {score}
                </span>
              ))}
            </div>
          </div>
          <span className="hidden text-on-surface-variant/40 md:inline">•</span>
          <div className="hidden font-data-mono text-[11px] text-on-surface-variant md:flex">
            Opta Matrix Engine:{" "}
            <strong className="ml-1 text-on-surface">
              v{packageJson.version} Build 2609
            </strong>
          </div>
        </div>

        <div className="flex items-center gap-space-lg">
          <div className="flex items-center gap-2 text-[10px] font-medium text-on-surface-variant">
            <span>Rows:</span>
            <div className="inline-flex gap-0.5 rounded-md bg-surface-container-lowest p-0.5 shadow-sm">
              {PAGE_SIZE_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setPageSize(opt)}
                  className={cn(
                    "rounded px-2 py-0.5 font-data-mono text-[10px]",
                    pageSize === opt
                      ? "bg-primary font-bold text-on-primary"
                      : "text-on-surface-variant hover:text-on-surface"
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 font-data-mono text-[11px] text-on-surface-variant">
            <span>
              Showing{" "}
              <strong className="text-on-surface">
                {total === 0 ? "0" : `${start + 1}–${end}`}
              </strong>{" "}
              of <strong className="text-on-surface">{total}</strong>
            </span>
            <div className="ml-2 flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous page"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="flex h-6 w-6 items-center justify-center rounded bg-surface-container-lowest text-on-surface-variant shadow-sm hover:text-on-surface disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Next page"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                className="flex h-6 w-6 items-center justify-center rounded bg-surface-container-lowest text-on-surface-variant shadow-sm hover:text-on-surface disabled:opacity-40"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    </TooltipProvider>
    </FixtureHorizonProvider>
  );
}
