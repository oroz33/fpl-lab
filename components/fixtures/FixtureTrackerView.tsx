"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import type {
  FdrPerspective,
  FixtureTrackerResponse,
  FixtureTrackerTeamRow,
  TrackerFixtureCell,
} from "@/lib/types";
import { TEAM_ACCENTS } from "@/lib/constants/teams";
import { FDR_COLORS } from "@/components/ui/fixture-badges";
import { cn, round } from "@/lib/utils";

type RangePreset = "next5" | "next10" | "full";
type PageSize = 25 | 50 | 100;
type SortKey = "team" | "avg";
type SortDir = "asc" | "desc";
type SortState = { key: SortKey; dir: SortDir };

const PAGE_SIZE_OPTIONS: PageSize[] = [25, 50, 100];

function teamDisplayName(team: FixtureTrackerTeamRow): string {
  return TEAM_ACCENTS[team.teamCode]?.name ?? team.teamName;
}

function gwEndForPreset(startGw: number, endGw: number, preset: RangePreset): number {
  if (preset === "next5") return Math.min(startGw + 4, endGw);
  if (preset === "next10") return Math.min(startGw + 9, endGw);
  return endGw;
}

function presetHorizon(preset: RangePreset): number {
  if (preset === "next5") return 5;
  if (preset === "next10") return 10;
  return 38;
}

function cellFdr(cell: TrackerFixtureCell, perspective: FdrPerspective): number {
  return perspective === "offensive" ? cell.fdrOff : cell.fdrDef;
}

function averageVisibleFdr(
  team: FixtureTrackerTeamRow,
  gws: number[],
  perspective: FdrPerspective
): number | null {
  const scores: number[] = [];
  for (const gw of gws) {
    for (const cell of team.byGw[gw] ?? []) {
      scores.push(cellFdr(cell, perspective));
    }
  }
  if (!scores.length) return null;
  return round(scores.reduce((a, b) => a + b, 0) / scores.length, 2);
}

function FixtureChip({
  cell,
  perspective,
  compact,
}: {
  cell: TrackerFixtureCell;
  perspective: FdrPerspective;
  compact?: boolean;
}) {
  const score = cellFdr(cell, perspective);
  const label = `${cell.opponentCode} (${cell.isHome ? "H" : "A"})`;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded border border-black/10 font-data-mono font-bold tracking-tight tabular-nums whitespace-nowrap text-white",
        compact ? "px-1 py-px text-[8px]" : "px-1.5 py-0.5 text-[9.5px]",
        FDR_COLORS[score] ?? FDR_COLORS[3]
      )}
      title={label}
    >
      {label}
    </span>
  );
}

function FixtureCell({
  cells,
  perspective,
}: {
  cells: TrackerFixtureCell[];
  perspective: FdrPerspective;
}) {
  if (!cells.length) {
    return (
      <div
        className="mx-auto h-7 w-[4.5rem] rounded border border-dashed border-slate-300/80 bg-transparent"
        aria-label="Blank gameweek"
      />
    );
  }

  if (cells.length === 1) {
    return (
      <div className="flex justify-center">
        <FixtureChip cell={cells[0]!} perspective={perspective} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      {cells.map((cell, i) => (
        <FixtureChip
          key={`${cell.opponentCode}-${cell.isHome ? "H" : "A"}-${i}`}
          cell={cell}
          perspective={perspective}
          compact
        />
      ))}
    </div>
  );
}

export function FixtureTrackerView() {
  const [data, setData] = useState<FixtureTrackerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<RangePreset>("full");
  const [perspective, setPerspective] = useState<FdrPerspective>("offensive");
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ key: "team", dir: "asc" });

  function toggleSort(key: SortKey) {
    setSort((prev) => {
      if (prev.key !== key) {
        // Team defaults A→Z; Avg defaults high→low (hardest first)
        return { key, dir: key === "avg" ? "desc" : "asc" };
      }
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/fixtures");
        if (!res.ok) throw new Error("Failed to load Fixture Tracker");
        const json = (await res.json()) as FixtureTrackerResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load fixtures");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const startGw = data?.startGw ?? 1;
  const seasonEnd = data?.endGw ?? 38;
  const rangeEnd = gwEndForPreset(startGw, seasonEnd, preset);

  const visibleGws = useMemo(() => {
    const gws: number[] = [];
    for (let gw = startGw; gw <= rangeEnd; gw++) gws.push(gw);
    return gws;
  }, [startGw, rangeEnd]);

  const horizonLabel = presetHorizon(preset);
  const nAvgLabel =
    preset === "full" ? `N${visibleGws.length} AVG` : `N${horizonLabel} AVG`;

  const sortedTeams = useMemo(() => {
    const teams = data?.teams ?? [];
    const copy = [...teams];
    copy.sort((a, b) => {
      if (sort.key === "team") {
        const an = teamDisplayName(a);
        const bn = teamDisplayName(b);
        return sort.dir === "asc"
          ? an.localeCompare(bn)
          : bn.localeCompare(an);
      }
      const aa = averageVisibleFdr(a, visibleGws, perspective);
      const bb = averageVisibleFdr(b, visibleGws, perspective);
      const an = aa ?? (sort.dir === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
      const bn = bb ?? (sort.dir === "asc" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
      return sort.dir === "asc" ? an - bn : bn - an;
    });
    return copy;
  }, [data?.teams, sort, visibleGws, perspective]);

  const total = sortedTeams.length;
  const pageCount = total === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize;
  const end = Math.min(start + pageSize, total);
  const pageRows = sortedTeams.slice(start, end);

  useEffect(() => {
    setPage(1);
  }, [pageSize, preset, perspective]);

  if (loading) {
    return (
      <div className="p-space-xl text-[13px] text-on-surface-variant">
        Loading Fixture Tracker…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-space-xl text-[13px] text-rose-700">
        {error ?? "No fixture data"}
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-[#F8F9FC]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-interior bg-white px-space-xl py-space-md">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[18px] font-bold tracking-tight text-on-surface">
            Fixture Tracker
          </h1>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-data-mono text-[11px] font-semibold tabular-nums text-slate-700">
            GW{startGw} – GW{rangeEnd}
          </span>
          <div className="inline-flex gap-0.5 rounded-md bg-surface-container p-0.5">
            {(
              [
                ["next5", "Next 5"],
                ["next10", "Next 10"],
                ["full", "Full Season"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPreset(id)}
                className={cn(
                  "rounded px-2.5 py-1 text-[11px] font-semibold transition-colors",
                  preset === id
                    ? "bg-white text-on-surface shadow-sm"
                    : "text-on-surface-variant hover:text-on-surface"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="inline-flex gap-0.5 rounded-md border border-border-interior bg-surface-container-lowest p-0.5">
          {(
            [
              ["offensive", "Offensive"],
              ["defensive", "Defensive"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPerspective(id)}
              className={cn(
                "rounded px-2.5 py-1 text-[11px] font-semibold transition-colors",
                perspective === id
                  ? "bg-[#0B132B] text-white"
                  : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-space-xl py-space-md">
        <div className="overflow-hidden rounded-lg border border-border-interior bg-white shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
          <div className="overflow-auto">
            <table className="w-max min-w-full border-collapse text-left">
              <thead>
                <tr className="bg-[#0B132B]">
                  <th className="freeze-col sticky left-0 z-30 w-[160px] min-w-[160px] bg-[#0B132B] px-space-md py-2.5 text-left">
                    <button
                      type="button"
                      onClick={() => toggleSort("team")}
                      className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-white hover:text-white/90"
                      aria-label={
                        sort.key === "team" && sort.dir === "asc"
                          ? "Sort teams Z to A"
                          : "Sort teams A to Z"
                      }
                    >
                      Team
                      {sort.key === "team" ? (
                        sort.dir === "asc" ? (
                          <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" />
                      )}
                    </button>
                  </th>
                  <th className="freeze-col sticky left-[160px] z-30 w-[88px] min-w-[88px] bg-[#0B132B] px-2 py-2.5 text-center shadow-[4px_0_10px_-2px_rgba(0,0,0,0.25)]">
                    <button
                      type="button"
                      onClick={() => toggleSort("avg")}
                      className="inline-flex w-full items-center justify-center gap-1 font-data-mono text-[10px] font-bold tabular-nums text-white/80 hover:text-white"
                      aria-label={
                        sort.key === "avg" && sort.dir === "desc"
                          ? "Sort average low to high"
                          : "Sort average high to low"
                      }
                    >
                      {nAvgLabel}
                      {sort.key === "avg" ? (
                        sort.dir === "asc" ? (
                          <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" />
                      )}
                    </button>
                  </th>
                  {visibleGws.map((gw) => (
                    <th
                      key={gw}
                      className="min-w-[88px] px-2 py-2.5 text-center font-data-mono text-[11px] font-bold tabular-nums text-white"
                    >
                      GW{gw}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((team) => {
                  const accent =
                    TEAM_ACCENTS[team.teamCode]?.accent ?? "#64748B";
                  const displayName = teamDisplayName(team);
                  const avg = averageVisibleFdr(team, visibleGws, perspective);

                  return (
                    <tr
                      key={team.teamId}
                      className="group border-b border-border-interior last:border-b-0"
                    >
                      <td className="freeze-col sticky left-0 z-20 w-[160px] min-w-[160px] bg-white px-space-md py-2 group-hover:bg-slate-50">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-4 w-1.5 shrink-0 rounded-sm"
                            style={{ backgroundColor: accent }}
                            aria-hidden
                          />
                          <span className="truncate text-[13px] font-semibold text-on-surface">
                            {displayName}
                          </span>
                        </div>
                      </td>
                      <td className="freeze-col sticky left-[160px] z-20 w-[88px] min-w-[88px] bg-white px-2 py-2 text-center shadow-[4px_0_10px_-2px_rgba(0,0,0,0.06)] group-hover:bg-slate-50">
                        <span
                          className={cn(
                            "inline-block font-data-mono text-[12px] font-semibold tabular-nums",
                            avg == null
                              ? "text-on-surface-variant/50"
                              : avg < 2.5
                                ? "text-emerald-700"
                                : avg <= 3.5
                                  ? "text-slate-600"
                                  : "text-rose-700"
                          )}
                        >
                          {avg == null ? "—" : avg.toFixed(2)}
                        </span>
                      </td>
                      {visibleGws.map((gw) => (
                        <td
                          key={`${team.teamCode}-${gw}`}
                          className="px-1.5 py-1.5 text-center align-middle"
                        >
                          <FixtureCell
                            cells={team.byGw[gw] ?? []}
                            perspective={perspective}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-interior bg-white px-space-xl py-space-sm">
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
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex h-6 w-6 items-center justify-center rounded bg-surface-container-lowest text-on-surface-variant shadow-sm hover:text-on-surface disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Next page"
              disabled={safePage >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              className="flex h-6 w-6 items-center justify-center rounded bg-surface-container-lowest text-on-surface-variant shadow-sm hover:text-on-surface disabled:opacity-40"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
