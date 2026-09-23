"use client";

import { useMemo, useState } from "react";
import { PlusCircle } from "lucide-react";
import { XGIVarianceBadge } from "@/components/analytics/xgi-variance-badge";
import {
  AvgFdrCell,
  FixtureHorizonProvider,
  FixturesCell,
  syncFixtureHorizon,
  type FixtureHorizon,
} from "@/components/ui/fixture-badges";
import { PositionBadge } from "@/components/ui/position-badge";
import { TeamAccentLabel } from "@/components/ui/team-accent";
import { resolveTeamAccent } from "@/lib/constants/teams";
import { buildHeatThresholds, heatmapClassForValue } from "@/lib/heatmap";
import { shortName } from "@/lib/h2h/metrics";
import type { PlayerRow, SquadMissingSlot } from "@/lib/types";
import { cn, formatNum } from "@/lib/utils";

const STICKY = {
  pos: { left: 0, width: 54 },
  player: { left: 54, width: 160 },
  team: { left: 214, width: 88 },
  next: { left: 302, width: 168 },
  fdr: { left: 470, width: 66 },
} as const;

const LAST_STICKY_SHADOW =
  "shadow-[4px_0_6px_-2px_rgba(0,0,0,0.12)]";
const LAST_STICKY_SHADOW_CELL =
  "shadow-[4px_0_6px_-2px_rgba(0,0,0,0.06)]";

type MetricKey =
  | "apps"
  | "mins"
  | "goals"
  | "xG"
  | "keyPasses"
  | "bigChancesCreated"
  | "assists"
  | "xA"
  | "xGI"
  | "corners"
  | "freeKicksTaken"
  | "penaltyGoals"
  | "dcPerGame";

type MetricCol = {
  key: MetricKey;
  label: string;
  digits: number;
  heatmap: boolean;
  width: string;
  get: (r: PlayerRow) => number | null;
};

const METRIC_COLS: MetricCol[] = [
  { key: "apps", label: "APPS", digits: 0, heatmap: false, width: "w-[48px]", get: (r) => r.apps },
  { key: "mins", label: "MINS", digits: 0, heatmap: false, width: "w-[54px]", get: (r) => r.mins },
  { key: "goals", label: "G", digits: 0, heatmap: true, width: "w-[44px]", get: (r) => r.goals },
  { key: "xG", label: "xG", digits: 2, heatmap: true, width: "w-[54px]", get: (r) => r.xG },
  { key: "keyPasses", label: "KP", digits: 0, heatmap: true, width: "w-[46px]", get: (r) => r.keyPasses },
  {
    key: "bigChancesCreated",
    label: "BCC",
    digits: 0,
    heatmap: true,
    width: "w-[46px]",
    get: (r) => r.bigChancesCreated,
  },
  { key: "assists", label: "A", digits: 0, heatmap: true, width: "w-[44px]", get: (r) => r.assists },
  { key: "xA", label: "xA", digits: 2, heatmap: true, width: "w-[54px]", get: (r) => r.xA },
  { key: "xGI", label: "xGI", digits: 2, heatmap: true, width: "w-[58px]", get: (r) => r.xGI },
  {
    key: "corners",
    label: "CORN",
    digits: 0,
    heatmap: true,
    width: "w-[56px]",
    get: (r) => r.corners,
  },
  {
    key: "freeKicksTaken",
    label: "FK",
    digits: 0,
    heatmap: true,
    width: "w-[54px]",
    get: (r) => r.freeKicksTaken,
  },
  {
    key: "penaltyGoals",
    label: "PENS",
    digits: 0,
    heatmap: true,
    width: "w-[54px]",
    get: (r) => r.penaltyGoals,
  },
  {
    key: "dcPerGame",
    label: "DC/G",
    digits: 2,
    heatmap: true,
    width: "w-[60px]",
    get: (r) => r.dcPerGame,
  },
];

const COL_COUNT = 5 + METRIC_COLS.length + 1; // sticky + metrics + Δ xGI

function stickyTh(last = false): string {
  return cn(
    "sticky z-30 bg-primary px-cell-px",
    last && LAST_STICKY_SHADOW
  );
}

function stickyTd(last = false): string {
  return cn(
    "sticky z-20 bg-surface-container-lowest px-cell-px group-hover:bg-surface-container-low",
    last && LAST_STICKY_SHADOW_CELL
  );
}

export function MyTeamLastFixturesTable({
  squadPlayers,
  leaguePlayers,
  missingSlots,
  onSelectSlot,
}: {
  squadPlayers: PlayerRow[];
  /** Full league for heatmap percentiles (not just squad). */
  leaguePlayers: PlayerRow[];
  missingSlots: SquadMissingSlot[];
  onSelectSlot: (position?: SquadMissingSlot["position"]) => void;
}) {
  const [horizon, setHorizon] = useState<FixtureHorizon>(3);

  const setHorizonSynced = (h: FixtureHorizon) => {
    syncFixtureHorizon(h);
    setHorizon(h);
  };

  // Keep module sync in sync for any getValue helpers
  syncFixtureHorizon(horizon);

  const heatMaps = useMemo(() => {
    const maps = new Map<string, ReturnType<typeof buildHeatThresholds>>();
    for (const col of METRIC_COLS) {
      if (!col.heatmap) continue;
      const values: number[] = [];
      for (const p of leaguePlayers) {
        const v = col.get(p);
        if (typeof v === "number" && Number.isFinite(v)) values.push(v);
      }
      maps.set(col.key, buildHeatThresholds(values));
    }
    return maps;
  }, [leaguePlayers]);

  return (
    <FixtureHorizonProvider horizon={horizon} setHorizon={setHorizonSynced}>
      <div className="w-full overflow-hidden rounded-b bg-surface-container-lowest shadow-sm">
        <div className="relative w-full overflow-x-auto">
          <table className="w-full border-collapse select-none text-left">
            <thead>
              <tr className="h-table-row-h bg-primary text-[11px] font-semibold tracking-[0.02em] text-on-primary uppercase">
                <th
                  className={cn(stickyTh(), "w-[54px] text-center")}
                  style={{ left: STICKY.pos.left, minWidth: STICKY.pos.width, width: STICKY.pos.width }}
                >
                  POS
                </th>
                <th
                  className={cn(stickyTh(), "w-[160px]")}
                  style={{ left: STICKY.player.left, minWidth: STICKY.player.width, width: STICKY.player.width }}
                >
                  PLAYER
                </th>
                <th
                  className={cn(stickyTh(), "w-[88px] text-center")}
                  style={{ left: STICKY.team.left, minWidth: STICKY.team.width, width: STICKY.team.width }}
                >
                  TEAM
                </th>
                <th
                  className={cn(stickyTh(), "w-[168px]")}
                  style={{ left: STICKY.next.left, minWidth: STICKY.next.width, width: STICKY.next.width }}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="tracking-wider text-on-primary uppercase">
                      NEXT
                    </span>
                    <div className="inline-flex items-center rounded bg-surface-container-high/20 p-0.5">
                      {([3, 5] as const).map((n) => {
                        const active = horizon === n;
                        return (
                          <button
                            key={n}
                            type="button"
                            className={cn(
                              "rounded px-1.5 py-0.5 font-data-mono text-[10px] leading-none transition-colors",
                              active
                                ? "bg-surface-container-lowest font-bold text-on-surface shadow-sm"
                                : "text-on-primary/60 hover:text-on-primary"
                            )}
                            onClick={() => setHorizonSynced(n)}
                          >
                            {n}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </th>
                <th
                  className={cn(
                    stickyTh(true),
                    "w-[66px] text-right"
                  )}
                  style={{ left: STICKY.fdr.left, minWidth: STICKY.fdr.width, width: STICKY.fdr.width }}
                >
                  FDR
                </th>
                {METRIC_COLS.slice(0, 9).map((col) => (
                  <th
                    key={col.key}
                    className={cn("px-cell-px text-right", col.width)}
                  >
                    {col.label}
                  </th>
                ))}
                <th className="w-[72px] px-cell-px text-center">
                  Δ xGI
                </th>
                {METRIC_COLS.slice(9).map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "px-cell-px",
                      col.key === "penaltyGoals" ? "text-center" : "text-right",
                      col.width
                    )}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container text-[12px]">
              {squadPlayers.map((row) => (
                <tr
                  key={row.id}
                  className="group h-table-row-h transition-colors duration-75 hover:bg-surface-container-low"
                >
                  <td
                    className={cn(stickyTd(), "text-center")}
                    style={{ left: STICKY.pos.left }}
                  >
                    <PositionBadge position={row.position} />
                  </td>
                  <td
                    className={stickyTd()}
                    style={{ left: STICKY.player.left }}
                  >
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <span
                        className="inline-block h-3 w-1 shrink-0 rounded-xs border border-white/10"
                        style={{
                          backgroundColor: resolveTeamAccent({
                            teamId: row.teamId,
                          }),
                        }}
                        aria-hidden
                      />
                      <span className="truncate text-[12px] font-semibold text-on-surface">
                        {shortName(row.name)}
                      </span>
                    </span>
                  </td>
                  <td
                    className={cn(
                      stickyTd(),
                      "text-center"
                    )}
                    style={{ left: STICKY.team.left }}
                  >
                    <TeamAccentLabel
                      label={row.teamShort}
                      teamId={row.teamId}
                    />
                  </td>
                  <td
                    className={stickyTd()}
                    style={{ left: STICKY.next.left }}
                  >
                    <FixturesCell fixtures={row.nextFixtures} />
                  </td>
                  <td
                    className={cn(stickyTd(true), "text-right")}
                    style={{ left: STICKY.fdr.left }}
                  >
                    <AvgFdrCell fixtures={row.nextFixtures} />
                  </td>
                  {METRIC_COLS.slice(0, 9).map((col) => {
                    const raw = col.get(row);
                    const heat =
                      col.heatmap && typeof raw === "number"
                        ? heatmapClassForValue(raw, heatMaps.get(col.key))
                        : "";
                    return (
                      <td
                        key={col.key}
                        className={cn(
                          "px-cell-px text-right font-data-mono text-[12px] tnum tabular-nums",
                          heat,
                          typeof raw === "number" && raw === 0 && !heat
                            ? "text-outline"
                            : ""
                        )}
                      >
                        {formatNum(raw, col.digits)}
                      </td>
                    );
                  })}
                  <td className="px-cell-px text-center font-data-mono text-[11px] tnum">
                    <XGIVarianceBadge
                      variance={row.xGiVariance}
                      actualReturns={row.actualReturns}
                      gi={row.gi}
                      xGI={row.xGI}
                      status={row.regressionStatus}
                    />
                  </td>
                  {METRIC_COLS.slice(9).map((col) => {
                    const raw = col.get(row);
                    const heat =
                      col.heatmap && typeof raw === "number"
                        ? heatmapClassForValue(raw, heatMaps.get(col.key))
                        : "";
                    const isPens = col.key === "penaltyGoals";
                    const isDc = col.key === "dcPerGame";
                    return (
                      <td
                        key={col.key}
                        className={cn(
                          "px-cell-px font-data-mono text-[12px] tnum tabular-nums",
                          isPens ? "text-center" : "text-right",
                          heat,
                          typeof raw === "number" && raw === 0 && !heat
                            ? "text-outline"
                            : "",
                          isDc && raw !== null ? "font-semibold" : ""
                        )}
                      >
                        {isDc && raw === null
                          ? "—"
                          : isPens && (raw === null || raw === 0)
                            ? "—"
                            : formatNum(raw, col.digits)}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {missingSlots.map((slot) => (
                <tr
                  key={slot.key}
                  className="h-table-row-h cursor-pointer bg-surface-container-low/30 transition-colors duration-75 hover:bg-surface-container-low/70"
                  onClick={() => onSelectSlot(slot.position)}
                >
                  <td className="px-cell-px py-2 text-center" colSpan={COL_COUNT}>
                    <div className="flex items-center justify-center gap-2 rounded border border-dashed border-outline-variant/60 px-3 py-1 text-outline transition-colors hover:border-outline hover:text-on-surface">
                      <PlusCircle className="h-[15px] w-[15px] shrink-0" />
                      <span className="font-data-mono text-[11px] font-medium tracking-wide uppercase">
                        [{slot.position} #{slot.slotIndex}] Select Here To Add
                        Your Player
                      </span>
                    </div>
                  </td>
                </tr>
              ))}

              {squadPlayers.length === 0 && missingSlots.length === 0 ? (
                <tr>
                  <td
                    colSpan={COL_COUNT}
                    className="px-cell-px py-8 text-center text-[13px] text-on-surface-variant"
                  >
                    No players selected. Edit Squad to build your 15.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </FixtureHorizonProvider>
  );
}
