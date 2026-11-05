"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { FdrScore, NextFixture, Position } from "@/lib/types";
import { cn, round } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Shared FDR 1–5 palette (export for DataTable legend + Fixture Tracker). */
export const FDR_COLORS: Record<number, string> = {
  1: "bg-[#15803D] text-white",
  2: "bg-[#16A34A] text-white",
  3: "bg-[#64748B] text-white",
  4: "bg-[#DC2626] text-white",
  5: "bg-[#991B1B] text-white",
};

export type FixtureHorizon = 3 | 5;
export type FdrMode = "overall" | "off" | "def";

/** Module sync so ColumnDef getValue can read the active horizon for sort/filter. */
let syncedHorizon: FixtureHorizon = 3;

export function syncFixtureHorizon(horizon: FixtureHorizon): void {
  syncedHorizon = horizon;
}

export function getSyncedFixtureHorizon(): FixtureHorizon {
  return syncedHorizon;
}

type FixtureHorizonContextValue = {
  horizon: FixtureHorizon;
  setHorizon: (horizon: FixtureHorizon) => void;
};

const FixtureHorizonContext = createContext<FixtureHorizonContextValue | null>(null);

export function FixtureHorizonProvider({
  horizon,
  setHorizon,
  children,
}: {
  horizon: FixtureHorizon;
  setHorizon: (horizon: FixtureHorizon) => void;
  children: ReactNode;
}) {
  return (
    <FixtureHorizonContext.Provider value={{ horizon, setHorizon }}>
      {children}
    </FixtureHorizonContext.Provider>
  );
}

export function useFixtureHorizon(): FixtureHorizonContextValue {
  const ctx = useContext(FixtureHorizonContext);
  if (!ctx) {
    return {
      horizon: 3,
      setHorizon: () => undefined,
    };
  }
  return ctx;
}

function fixtureLabel(f: NextFixture): string {
  return `${f.opponentShortName} (${f.isHome ? "H" : "A"})`;
}

/** GK/DEF → defensive FDR; MID/FWD → offensive FDR. */
export function fdrPerspectiveForPosition(position: Position | undefined): FdrMode {
  if (position === "GKP" || position === "DEF") return "def";
  if (position === "MID" || position === "FWD") return "off";
  return "overall";
}

export function pickFdr(fixture: NextFixture, mode: FdrMode): FdrScore {
  if (mode === "off") return fixture.fdrOff;
  if (mode === "def") return fixture.fdrDef;
  return fixture.fdrOverall;
}

export function pickFdrRaw(fixture: NextFixture, mode: FdrMode): number {
  if (mode === "off") return fixture.fdrOffRaw;
  if (mode === "def") return fixture.fdrDefRaw;
  return fixture.fdrOverallRaw;
}

export function averageOverallFdr(
  fixtures: NextFixture[] | undefined,
  horizon: FixtureHorizon
): number | null {
  return averageFdrByMode(fixtures, horizon, "overall");
}

export function averagePositionFdr(
  fixtures: NextFixture[] | undefined,
  horizon: FixtureHorizon,
  position: Position | undefined
): number | null {
  return averageFdrByMode(fixtures, horizon, fdrPerspectiveForPosition(position));
}

export function averageFdrByMode(
  fixtures: NextFixture[] | undefined,
  horizon: FixtureHorizon,
  mode: FdrMode
): number | null {
  const slice = (fixtures ?? []).slice(0, horizon);
  if (!slice.length) return null;
  const sum = slice.reduce((acc, f) => acc + pickFdrRaw(f, mode), 0);
  return round(sum / slice.length, 2);
}

export function avgFdrToneClass(avg: number): string {
  if (avg < 2.5) return "text-emerald-700";
  if (avg <= 3.5) return "text-slate-600";
  return "text-rose-700";
}

export function FixtureBadges({
  fixtures,
  horizon = 3,
  position,
  mode,
}: {
  fixtures: NextFixture[];
  horizon?: FixtureHorizon;
  /** When set, badge color uses Off (MID/FWD) or Def (GKP/DEF). */
  position?: Position;
  /** Explicit mode overrides position. Default overall when neither set. */
  mode?: FdrMode;
}) {
  const resolved = mode ?? fdrPerspectiveForPosition(position);
  const visible = fixtures.slice(0, horizon);
  if (!visible.length) {
    return <span className="text-[10px] text-on-surface-variant/50">—</span>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <span className="inline-flex max-w-full flex-nowrap items-center gap-0.5 overflow-hidden">
        {visible.map((fixture) => {
          const label = fixtureLabel(fixture);
          const compact = horizon === 5;
          const score = pickFdr(fixture, resolved);
          return (
            <Tooltip
              key={`${fixture.event}-${fixture.opponentShortName}-${fixture.isHome}`}
            >
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "inline-flex shrink-0 cursor-default items-center justify-center rounded border border-black/10 font-data-mono font-bold tracking-tight tabular-nums whitespace-nowrap",
                    compact
                      ? "px-1 py-0.5 text-[9px]"
                      : "px-1.5 py-0.5 text-[9.5px]",
                    FDR_COLORS[score] ?? FDR_COLORS[3]
                  )}
                >
                  {label}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <div className="font-data-mono text-[11px] tabular-nums text-slate-900">
                  {label} • Shown: {resolved.toUpperCase()} {score} | Overall:{" "}
                  {fixture.fdrOverall} | Off: {fixture.fdrOff} | Def:{" "}
                  {fixture.fdrDef}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </span>
    </TooltipProvider>
  );
}

export function FixturesCell({
  fixtures,
  position,
}: {
  fixtures: NextFixture[] | undefined;
  position?: Position;
}) {
  const { horizon } = useFixtureHorizon();
  return (
    <div className="w-full max-w-full overflow-hidden">
      <FixtureBadges
        fixtures={fixtures ?? []}
        horizon={horizon}
        position={position}
      />
    </div>
  );
}

export function AvgFdrCell({
  fixtures,
  position,
}: {
  fixtures: NextFixture[] | undefined;
  position?: Position;
}) {
  const { horizon } = useFixtureHorizon();
  const avg = position
    ? averagePositionFdr(fixtures, horizon, position)
    : averageOverallFdr(fixtures, horizon);
  if (avg === null) {
    return <span className="text-on-surface-variant/50">—</span>;
  }
  return (
    <span
      className={cn(
        "font-data-mono text-[12px] font-semibold tabular-nums",
        avgFdrToneClass(avg)
      )}
    >
      {avg.toFixed(2)}
    </span>
  );
}

export function fixturesSortValue(fixtures: NextFixture[] | undefined): string {
  if (!fixtures?.length) return "";
  return fixtures.map(fixtureLabel).join(" ");
}
