"use client";

import { Plus } from "lucide-react";
import { TeamAccentLabel } from "@/components/ui/team-accent";
import { chipShortName } from "@/lib/squad/rules";
import type { PlayerRow, Position, SquadMissingSlot } from "@/lib/types";
import { SQUAD_POSITION_ORDER } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SquadMiniBar({
  squadPlayers,
  missingSlots,
  onAddPosition,
  onEditPlayer,
}: {
  squadPlayers: PlayerRow[];
  missingSlots: SquadMissingSlot[];
  onAddPosition: (position: Position) => void;
  onEditPlayer?: (player: PlayerRow) => void;
}) {
  const byPos = SQUAD_POSITION_ORDER.map((position) => ({
    position,
    players: squadPlayers.filter((p) => p.position === position),
    empties: missingSlots.filter((s) => s.position === position),
  }));

  return (
    <div className="w-full select-none overflow-x-auto rounded bg-surface-container-lowest p-space-sm shadow-sm">
      <div className="flex min-w-[1180px] items-center gap-space-sm">
        {byPos.map(({ position, players, empties }, groupIdx) => (
          <div
            key={position}
            className={cn(
              "flex items-center gap-1",
              groupIdx < byPos.length - 1 &&
                "border-r border-surface-container-high pr-space-sm"
            )}
          >
            <span className="px-1 text-[9px] font-bold tracking-wider text-outline uppercase">
              {position}
            </span>
            {players.map((p) => (
              <button
                key={p.id}
                type="button"
                className="group flex cursor-pointer items-center gap-1.5 rounded bg-surface-container-low px-2 py-1 text-[11px] font-semibold transition-colors hover:bg-surface-container"
                onClick={() => onEditPlayer?.(p)}
              >
                <TeamAccentLabel label={chipShortName(p.name)} teamId={p.teamId} />
              </button>
            ))}
            {empties.map((slot) => (
              <button
                key={slot.key}
                type="button"
                className="flex cursor-pointer items-center gap-1 rounded border border-dashed border-outline/40 bg-surface-container-low/30 px-2 py-1 text-outline transition-colors hover:border-outline hover:bg-surface-container-low hover:text-on-surface"
                onClick={() => onAddPosition(position)}
              >
                <Plus className="h-3 w-3" />
                <span className="font-data-mono text-[11px] font-medium">
                  {position}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
