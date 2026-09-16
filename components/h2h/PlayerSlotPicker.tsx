"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { PlayerRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { shortName } from "@/lib/h2h/metrics";

export function PlayerSlotPicker({
  slot,
  player,
  players,
  accent,
  excludeId,
  onSelect,
}: {
  slot: "a" | "b";
  player: PlayerRow | null;
  players: PlayerRow[];
  accent: "emerald" | "secondary";
  excludeId?: string | null;
  onSelect: (player: PlayerRow) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players
      .filter((p) => p.id !== excludeId)
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.teamShort.toLowerCase().includes(q) ||
          p.team.toLowerCase().includes(q)
      )
      .sort((a, b) => b.mins - a.mins)
      .slice(0, 40);
  }, [players, query, excludeId]);

  const bar =
    accent === "emerald" ? "bg-tertiary-container" : "bg-secondary";
  const badge =
    accent === "emerald"
      ? "bg-tertiary-fixed text-on-tertiary-fixed"
      : "bg-secondary-fixed text-on-secondary-fixed";

  return (
    <div
      ref={rootRef}
      className="relative flex w-full items-center gap-space-md rounded-lg bg-surface-container-low p-space-sm xl:w-5/12"
    >
      <div className={cn("h-10 w-2.5 shrink-0 rounded-sm", bar)} title={`Player ${slot.toUpperCase()} color`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-space-xs">
          <span className={cn("rounded px-space-xs py-0.5 text-[10px] font-bold uppercase", badge)}>
            Player {slot.toUpperCase()}
          </span>
          {player ? (
            <span className="font-data-mono text-[11px] font-semibold text-on-surface-variant">
              {player.team.toUpperCase()}
            </span>
          ) : (
            <span className="text-[11px] text-on-surface-variant">Select a player</span>
          )}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="truncate text-[16px] font-bold tracking-tight text-on-surface">
            {player ? shortName(player.name) : "—"}
          </span>
          {player ? (
            <span className="shrink-0 font-data-mono text-[12px] font-semibold text-on-surface">
              {player.mins}′ <span className="font-normal text-on-surface-variant">| {player.position}</span>
            </span>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        title={`Change Player ${slot.toUpperCase()}`}
        className="shrink-0 rounded bg-surface-container-lowest p-space-xs text-on-surface-variant transition-colors hover:bg-surface-container"
        onClick={() => {
          setOpen((v) => !v);
          setQuery("");
        }}
      >
        <Search className="h-[18px] w-[18px]" />
      </button>

      {open ? (
        <div className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-lowest shadow-lg">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search player or team…"
            className="w-full border-b border-surface-container bg-transparent px-space-md py-space-sm text-[13px] outline-none"
          />
          <ul className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-space-md py-space-sm text-[12px] text-on-surface-variant">No matches</li>
            ) : (
              filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-space-md py-space-sm text-left hover:bg-surface-container-low"
                    onClick={() => {
                      onSelect(p);
                      setOpen(false);
                    }}
                  >
                    <span className="truncate text-[13px] font-semibold text-on-surface">
                      {p.name}{" "}
                      <span className="font-normal text-on-surface-variant">
                        · {p.teamShort} · {p.position}
                      </span>
                    </span>
                    <span className="shrink-0 font-data-mono text-[11px] text-on-surface-variant">
                      {p.mins}′
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
