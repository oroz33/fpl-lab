"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { NextFixture } from "@/lib/types";
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

export function averageOverallFdr(
  fixtures: NextFixture[] | undefined,
  horizon: FixtureHorizon
): number | null {
  const slice = (fixtures ?? []).slice(0, horizon);
  if (!slice.length) return null;
  const sum = slice.reduce((acc, f) => acc + f.fdrOverall, 0);
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
}: {
  fixtures: NextFixture[];
  horizon?: FixtureHorizon;
}) {
  const visible = fixtures.slice(0, horizon);
  if (!visible.length) {
    return <span className="text-[10px] text-on-surface-variant/50">—</span>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <span className="inline-flex items-center gap-1">
        {visible.map((fixture) => {
          const label = fixtureLabel(fixture);
          return (
            <Tooltip
              key={`${fixture.event}-${fixture.opponentShortName}-${fixture.isHome}`}
            >
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "inline-flex cursor-default items-center justify-center rounded border border-black/10 px-1.5 py-0.5 font-data-mono text-[9.5px] font-bold tracking-tight tabular-nums whitespace-nowrap",
                    FDR_COLORS[fixture.fdrOverall] ?? FDR_COLORS[3]
                  )}
                >
                  {label}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <div className="font-data-mono text-[11px] tabular-nums text-slate-900">
                  {label} • Overall FDR: {fixture.fdrOverall} | Off FDR:{" "}
                  {fixture.fdrOff} | Def FDR: {fixture.fdrDef}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </span>
    </TooltipProvider>
  );
}

export function FixturesCell({ fixtures }: { fixtures: NextFixture[] | undefined }) {
  const { horizon } = useFixtureHorizon();
  return <FixtureBadges fixtures={fixtures ?? []} horizon={horizon} />;
}

export function AvgFdrCell({ fixtures }: { fixtures: NextFixture[] | undefined }) {
  const { horizon } = useFixtureHorizon();
  const avg = averageOverallFdr(fixtures, horizon);
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
