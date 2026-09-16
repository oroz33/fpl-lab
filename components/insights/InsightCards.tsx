"use client";

import { useMemo } from "react";
import { Bolt, Network, TrendingUp } from "lucide-react";
import type { PlayerRow } from "@/lib/types";

export function InsightCards({
  players,
  fromGw,
  toGw,
}: {
  players: PlayerRow[];
  fromGw: number;
  toGw: number;
}) {
  const underperformer = useMemo(() => {
    return [...players]
      .filter((p) => p.xG > 1 && p.goals <= 1)
      .sort((a, b) => b.xG - a.xG - (b.goals - a.goals))[0];
  }, [players]);

  const keyPassLead = useMemo(() => {
    return [...players].sort((a, b) => b.keyPasses - a.keyPasses)[0];
  }, [players]);

  const greenRun = useMemo(() => {
    const scored = players
      .map((p) => {
        const fixtures = p.nextFixtures ?? [];
        if (fixtures.length < 2) return null;
        const avg =
          fixtures.reduce((sum, f) => sum + f.fdrDef, 0) / fixtures.length;
        return { player: p, avg, fixtures };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null && x.avg <= 2.5)
      .sort((a, b) => a.avg - b.avg)[0];
    return scored;
  }, [players]);

  return (
    <div className="grid grid-cols-1 gap-space-lg pt-space-xs md:grid-cols-3">
      <div className="space-y-space-sm rounded-xl bg-surface-container-lowest p-space-lg shadow-[0_2px_10px_rgba(11,28,48,0.03)]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[14px] font-semibold text-on-surface">
            <Bolt className="h-[18px] w-[18px] text-primary" />
            xG Underperformers / Overhaul
          </span>
          <span className="rounded bg-surface-container-low px-1.5 py-0.5 font-data-mono text-[11px] text-on-surface-variant">
            GW{fromGw}–{toGw}
          </span>
        </div>
        <p className="text-[12px] text-on-surface-variant">
          Players with &gt;1.00 aggregate xG but single goal conversion. High
          regression-to-mean probability next 3 gameweeks.
        </p>
        <div className="flex items-center justify-between border-t border-surface-container pt-1 font-data-mono text-[11px]">
          {underperformer ? (
            <>
              <span className="font-semibold text-on-surface">
                {underperformer.name} ({underperformer.teamShort})
              </span>
              <span className="rounded bg-tertiary-fixed/30 px-2 py-0.5 font-bold text-on-tertiary-container">
                {underperformer.xG.toFixed(2)} xG • {underperformer.goals} G
              </span>
            </>
          ) : (
            <span className="text-on-surface-variant">No underperformers in range</span>
          )}
        </div>
      </div>

      <div className="space-y-space-sm rounded-xl bg-surface-container-lowest p-space-lg shadow-[0_2px_10px_rgba(11,28,48,0.03)]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[14px] font-semibold text-on-surface">
            <Network className="h-[18px] w-[18px] text-primary" />
            Top Key Pass Creators
          </span>
          <span className="rounded bg-surface-container-low px-1.5 py-0.5 font-data-mono text-[11px] text-on-surface-variant">
            Per sample
          </span>
        </div>
        <p className="text-[12px] text-on-surface-variant">
          Leading architects generating high-leverage box opportunities and
          shot-creating actions across early fixtures.
        </p>
        <div className="flex items-center justify-between border-t border-surface-container pt-1 font-data-mono text-[11px]">
          {keyPassLead && keyPassLead.keyPasses > 0 ? (
            <>
              <span className="font-semibold text-on-surface">
                {keyPassLead.name} • {keyPassLead.teamShort}
              </span>
              <span className="rounded bg-secondary-container/50 px-2 py-0.5 font-bold text-secondary">
                {keyPassLead.keyPasses} KP • {keyPassLead.bigChancesCreated} BCC
              </span>
            </>
          ) : (
            <span className="text-on-surface-variant">No key-pass data</span>
          )}
        </div>
      </div>

      <div className="space-y-space-sm rounded-xl bg-surface-container-lowest p-space-lg shadow-[0_2px_10px_rgba(11,28,48,0.03)]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[14px] font-semibold text-on-surface">
            <TrendingUp className="h-[18px] w-[18px] text-primary" />
            FDR Run Advantage
          </span>
          <span className="rounded bg-tertiary-fixed/30 px-2 py-0.5 text-[10px] font-bold tracking-[0.03em] text-[#15803D] uppercase">
            Green Run
          </span>
        </div>
        <p className="text-[12px] text-on-surface-variant">
          Assets facing softer FDR corridors across the upcoming fixture window.
        </p>
        <div className="flex items-center justify-between border-t border-surface-container pt-1 font-data-mono text-[11px]">
          {greenRun ? (
            <>
              <span className="font-semibold text-on-surface">
                {greenRun.player.teamShort}:{" "}
                {greenRun.fixtures
                  .slice(0, 2)
                  .map(
                    (f) =>
                      `${f.opponentShortName} (${f.isHome ? "H" : "A"})`
                  )
                  .join(", ")}
              </span>
              <span className="font-bold text-primary">
                Avg FDR {greenRun.avg.toFixed(2)}
              </span>
            </>
          ) : (
            <span className="text-on-surface-variant">No green runs detected</span>
          )}
        </div>
      </div>
    </div>
  );
}
