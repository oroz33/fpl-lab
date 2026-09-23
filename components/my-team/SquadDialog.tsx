"use client";

import { useMemo, useState } from "react";
import { Check, Search, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PositionBadge } from "@/components/ui/position-badge";
import { TeamAccentLabel } from "@/components/ui/team-accent";
import {
  addPlayerBlockLabel,
  canAddPlayer,
} from "@/lib/squad/rules";
import { shortName } from "@/lib/h2h/metrics";
import type { PlayerRow, Position } from "@/lib/types";
import { SQUAD_POSITION_ORDER, SQUAD_SIZE } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SquadDialog({
  open,
  onOpenChange,
  players,
  squadPlayers,
  lockPosition,
  onAdd,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  players: PlayerRow[];
  squadPlayers: PlayerRow[];
  /** When set, list is filtered to this position (empty-slot / mini-bar add). */
  lockPosition?: Position | null;
  onAdd: (player: PlayerRow) => void;
  onRemove: (playerId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [posFilter, setPosFilter] = useState<Position | "All">("All");

  const effectivePos = lockPosition ?? (posFilter === "All" ? null : posFilter);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players
      .filter((p) => (effectivePos ? p.position === effectivePos : true))
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.teamShort.toLowerCase().includes(q) ||
          p.team.toLowerCase().includes(q)
      )
      .sort((a, b) => b.mins - a.mins)
      .slice(0, 60);
  }, [players, query, effectivePos]);

  const selectedIds = useMemo(
    () => new Set(squadPlayers.map((p) => p.id)),
    [squadPlayers]
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setQuery("");
          setPosFilter("All");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg border-outline-variant/40 bg-surface-container-lowest p-0">
        <DialogHeader className="border-b border-surface-container px-space-xl py-space-lg">
          <DialogTitle className="text-[16px] font-bold tracking-tight text-on-surface">
            {lockPosition
              ? `Add ${lockPosition}`
              : "Edit Squad"}
          </DialogTitle>
          <DialogDescription className="text-[12px] text-on-surface-variant">
            {squadPlayers.length}/{SQUAD_SIZE} selected · Max 3 per club ·{" "}
            {lockPosition
              ? `Showing ${lockPosition} only`
              : "2 GKP · 5 DEF · 5 MID · 3 FWD"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-space-md px-space-xl py-space-md">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-space-md h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search player or team…"
              className="h-filter-h w-full rounded border border-outline-variant/40 bg-surface-container-low py-space-sm pr-space-md pl-9 text-[13px] outline-none focus:border-outline"
            />
          </div>

          {!lockPosition ? (
            <div className="flex flex-wrap gap-1">
              {(["All", ...SQUAD_POSITION_ORDER] as const).map((pos) => {
                const active = posFilter === pos;
                return (
                  <button
                    key={pos}
                    type="button"
                    className={cn(
                      "rounded px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase transition-colors",
                      active
                        ? "bg-primary text-on-primary"
                        : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                    )}
                    onClick={() => setPosFilter(pos)}
                  >
                    {pos}
                  </button>
                );
              })}
            </div>
          ) : null}

          {squadPlayers.length > 0 ? (
            <div>
              <div className="mb-1 text-[10px] font-bold tracking-wider text-outline uppercase">
                Current squad
              </div>
              <ul className="max-h-28 space-y-0.5 overflow-y-auto rounded border border-surface-container">
                {squadPlayers.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 px-space-md py-1.5 hover:bg-surface-container-low"
                  >
                    <span className="inline-flex min-w-0 items-center gap-space-sm">
                      <PositionBadge position={p.position} />
                      <TeamAccentLabel
                        label={shortName(p.name)}
                        teamId={p.teamId}
                      />
                      <span className="font-data-mono text-[10px] text-on-surface-variant">
                        {p.teamShort}
                      </span>
                    </span>
                    <button
                      type="button"
                      title="Remove from squad"
                      className="rounded p-1 text-on-surface-variant hover:bg-error-container/40 hover:text-error"
                      onClick={() => onRemove(p.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <ul className="max-h-72 overflow-y-auto rounded border border-surface-container py-1">
            {filtered.length === 0 ? (
              <li className="px-space-md py-space-sm text-[12px] text-on-surface-variant">
                No matches
              </li>
            ) : (
              filtered.map((p) => {
                const selected = selectedIds.has(p.id);
                const check = canAddPlayer(squadPlayers, p);
                const disabled = !selected && !check.ok;
                const reason =
                  !selected && !check.ok
                    ? addPlayerBlockLabel(check.reason)
                    : null;

                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      title={reason ?? undefined}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-space-md py-space-sm text-left transition-colors",
                        disabled
                          ? "cursor-not-allowed opacity-50"
                          : "hover:bg-surface-container-low",
                        selected && "bg-surface-container-low/80"
                      )}
                      onClick={() => {
                        if (selected) {
                          onRemove(p.id);
                          return;
                        }
                        if (!check.ok) return;
                        onAdd(p);
                        if (lockPosition) onOpenChange(false);
                      }}
                    >
                      <span className="inline-flex min-w-0 items-center gap-space-sm">
                        <PositionBadge position={p.position} />
                        <span className="truncate text-[13px] font-semibold text-on-surface">
                          {shortName(p.name)}
                        </span>
                        <span className="font-data-mono text-[11px] text-on-surface-variant">
                          {p.teamShort}
                        </span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-2">
                        {reason ? (
                          <span className="font-data-mono text-[10px] text-outline">
                            {reason}
                          </span>
                        ) : null}
                        <span className="font-data-mono text-[11px] text-on-surface-variant">
                          {p.mins}′
                        </span>
                        {selected ? (
                          <Check className="h-4 w-4 text-on-tertiary-container" />
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
