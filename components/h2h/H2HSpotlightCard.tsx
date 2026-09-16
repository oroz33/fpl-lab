"use client";

import type { PlayerRow } from "@/lib/types";
import { formatNum } from "@/lib/utils";
import { PositionBadge } from "@/components/ui/position-badge";
import { FixtureBadges } from "@/components/ui/fixture-badges";
import { avgNextFdr } from "@/lib/h2h/metrics";
import { cn } from "@/lib/utils";

export function H2HSpotlightCard({
  player,
  accent,
}: {
  player: PlayerRow;
  accent: "emerald" | "secondary";
}) {
  const fdrAvg = avgNextFdr(player, "overall");
  const tagColor =
    accent === "emerald" ? "text-on-tertiary-container" : "text-secondary";

  return (
    <div className="relative overflow-hidden rounded-xl bg-surface-container-lowest p-space-lg shadow-[0_1px_4px_rgba(0,0,0,0.03)]">
      <div className="flex items-start justify-between gap-space-md">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-space-xs">
            <PositionBadge position={player.position} />
            <span className="font-data-mono text-[11px] text-on-surface-variant">
              {player.teamShort} · {player.apps} apps
            </span>
          </div>
          <h2 className="mt-1 truncate text-[20px] font-bold tracking-tight text-on-surface">
            {player.name}
          </h2>
        </div>
        <div className="shrink-0 text-right">
          <span className="block font-data-mono text-[12px] font-bold text-on-surface">
            {player.mins} mins
          </span>
          <span className="text-[10px] font-medium text-on-surface-variant">
            Sample window
          </span>
        </div>
      </div>

      <div className="mt-space-md grid grid-cols-4 gap-space-xs rounded-lg bg-surface-container-low p-space-sm">
        <Metric label="Mins" value={String(player.mins)} />
        <Metric
          label="Goals / Ast"
          value={`${player.goals} / ${player.assists}`}
        />
        <Metric
          label="xG / xGI"
          value={`${formatNum(player.xG)} / ${formatNum(player.xGI)}`}
          className={tagColor}
        />
        <Metric
          label={accent === "emerald" ? "Shots" : "KP / BCC"}
          value={
            accent === "emerald"
              ? `${player.shots} (${player.shotsInsideBox} SIB)`
              : `${player.keyPasses} / ${player.bigChancesCreated}`
          }
          className={accent === "secondary" ? tagColor : undefined}
        />
      </div>

      <div className="mt-space-md flex flex-wrap items-center justify-between gap-2 pt-space-xs">
        <span className="text-[10px] font-semibold uppercase text-on-surface-variant">
          Next 3 Runs
          {fdrAvg !== null ? ` (Avg ${formatNum(fdrAvg)} FDR)` : ""}
        </span>
        <FixtureBadges fixtures={player.nextFixtures ?? []} />
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="text-center">
      <span className="block text-[10px] font-medium uppercase text-on-surface-variant">
        {label}
      </span>
      <span
        className={cn(
          "font-data-mono text-[12px] font-bold text-on-surface",
          className
        )}
      >
        {value}
      </span>
    </div>
  );
}
