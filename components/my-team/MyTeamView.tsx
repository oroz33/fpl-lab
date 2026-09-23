"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Newspaper,
  PencilLine,
  RotateCcw,
  Table2,
} from "lucide-react";
import { useAppShell } from "@/components/layout/AppShell";
import { GameweekRange } from "@/components/filters/GameweekRange";
import { MyTeamLastFixturesTable } from "@/components/my-team/MyTeamLastFixturesTable";
import { MyTeamNewsGrid } from "@/components/my-team/MyTeamNewsGrid";
import { SquadDialog } from "@/components/my-team/SquadDialog";
import { SquadMiniBar } from "@/components/my-team/SquadMiniBar";
import { getMissingSlots, sortSquadPlayers } from "@/lib/squad/rules";
import { useMyTeamSquad } from "@/lib/squad/use-my-team";
import type {
  MetaResponse,
  PlayerRow,
  Position,
  StatsResponse,
} from "@/lib/types";
import { SQUAD_SIZE } from "@/lib/types";
import { cn } from "@/lib/utils";

type TabId = "fixtures" | "intel";

export function MyTeamView() {
  const { registerIngestHandler } = useAppShell();
  const {
    playerIds,
    hydrated,
    addPlayer,
    removePlayer,
    clearSquad,
  } = useMyTeamSquad();

  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromGw, setFromGw] = useState(1);
  const [toGw, setToGw] = useState(3);
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState<TabId>("fixtures");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [lockPosition, setLockPosition] = useState<Position | null>(null);

  const loadMeta = useCallback(async () => {
    const res = await fetch("/api/meta");
    const data = (await res.json()) as MetaResponse;
    setMeta(data);
    setToGw((prev) =>
      Math.min(Math.max(prev, data.maxGameweek), data.maxGameweek)
    );
  }, []);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        from: String(fromGw),
        to: String(toGw),
        position: "All",
        q: "",
      });
      const res = await fetch(`/api/stats?${params}`);
      if (!res.ok) throw new Error("Failed to load stats");
      const data = (await res.json()) as StatsResponse;
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [fromGw, toGw]);

  useEffect(() => {
    loadMeta().catch(() => undefined);
  }, [loadMeta, refreshKey]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadStats().catch(() => undefined);
    }, 150);
    return () => clearTimeout(t);
  }, [loadStats, refreshKey]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    registerIngestHandler(refresh);
    return () => registerIngestHandler(null);
  }, [registerIngestHandler, refresh]);

  const leaguePlayers = stats?.players ?? [];

  const squadPlayers = useMemo(() => {
    if (!hydrated || !playerIds.length) return [] as PlayerRow[];
    const byId = new Map(leaguePlayers.map((p) => [p.id, p]));
    const resolved: PlayerRow[] = [];
    for (const id of playerIds) {
      const row = byId.get(id);
      if (row) resolved.push(row);
    }
    return sortSquadPlayers(resolved);
  }, [hydrated, playerIds, leaguePlayers]);

  const missingSlots = useMemo(
    () => getMissingSlots(squadPlayers),
    [squadPlayers]
  );

  const count = squadPlayers.length;
  const complete = count === SQUAD_SIZE;

  const openDialog = useCallback((position?: Position | null) => {
    setLockPosition(position ?? null);
    setDialogOpen(true);
  }, []);

  const maxGw = meta?.maxGameweek ?? 3;

  return (
    <div className="mx-auto w-full max-w-[1720px] space-y-space-md p-3 md:px-space-xl md:py-space-lg">
      <div className="flex w-full flex-col text-on-surface">
      <div className="mb-space-lg flex w-full flex-col gap-space-md">
        <div className="flex flex-wrap items-center justify-between gap-space-md">
          <div className="flex flex-wrap items-center gap-space-md">
            <div className="flex items-center gap-space-xs">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-on-tertiary-container ring-4 ring-tertiary-fixed/20" />
              <h1 className="text-[20px] font-bold tracking-tight text-on-surface uppercase">
                My Team
              </h1>
            </div>
            <div
              className={cn(
                "flex items-center gap-space-xs rounded-full bg-surface-container px-2.5 py-0.5 text-[10px] font-bold tracking-wider shadow-sm uppercase",
                complete
                  ? "text-on-tertiary-container"
                  : "text-on-surface-variant"
              )}
            >
              {complete ? (
                <CheckCircle2 className="h-[14px] w-[14px]" />
              ) : (
                <Circle className="h-[14px] w-[14px] text-outline" />
              )}
              <span>
                {count}/{SQUAD_SIZE} PLAYERS SELECTED
              </span>
            </div>
            <GameweekRange
              from={fromGw}
              to={toGw}
              max={maxGw}
              onChange={(f, t) => {
                setFromGw(f);
                setToGw(t);
              }}
            />
          </div>

          <div className="flex items-center gap-space-md">
            <button
              type="button"
              className="inline-flex h-filter-h items-center gap-space-xs rounded bg-primary px-space-md text-[14px] font-semibold text-on-primary shadow-sm transition-all duration-100 hover:bg-secondary"
              onClick={() => openDialog(null)}
            >
              <PencilLine className="h-4 w-4" />
              <span>Edit Squad</span>
            </button>
            <button
              type="button"
              className="inline-flex h-filter-h items-center gap-space-xs rounded bg-surface-container-lowest px-space-md text-[12px] text-on-surface-variant shadow-sm transition-all duration-100 hover:bg-error-container/30 hover:text-error disabled:opacity-40"
              onClick={() => {
                if (
                  count > 0 &&
                  typeof window !== "undefined" &&
                  !window.confirm("Clear entire squad?")
                ) {
                  return;
                }
                clearSquad();
              }}
              disabled={count === 0}
            >
              <RotateCcw className="h-4 w-4" />
              <span>Clear Squad</span>
            </button>
          </div>
        </div>

        <SquadMiniBar
          squadPlayers={squadPlayers}
          missingSlots={missingSlots}
          onAddPosition={(pos) => openDialog(pos)}
          onEditPlayer={() => openDialog(null)}
        />
      </div>

      <div className="flex w-full items-center justify-between rounded-t bg-surface-container-lowest px-space-md shadow-sm">
        <div className="flex items-center gap-space-lg">
          <button
            type="button"
            className={cn(
              "relative flex items-center gap-space-xs py-space-sm text-[14px] font-semibold transition-colors",
              tab === "fixtures"
                ? "text-on-surface"
                : "text-outline hover:text-on-surface"
            )}
            onClick={() => setTab("fixtures")}
          >
            <Table2
              className={cn(
                "h-[18px] w-[18px]",
                tab === "fixtures" ? "text-on-surface" : undefined
              )}
            />
            <span>Last Fixtures Stats</span>
            {tab === "fixtures" ? (
              <span className="absolute right-0 bottom-0 left-0 h-0.5 bg-primary" />
            ) : null}
          </button>
          <button
            type="button"
            className={cn(
              "relative flex items-center gap-space-xs py-space-sm text-[14px] font-semibold transition-colors",
              tab === "intel"
                ? "text-on-surface"
                : "text-outline hover:text-on-surface"
            )}
            onClick={() => setTab("intel")}
          >
            <Newspaper
              className={cn(
                "h-[18px] w-[18px]",
                tab === "intel" ? "text-on-surface" : undefined
              )}
            />
            <span>News &amp; Team Intel</span>
            {tab === "intel" ? (
              <span className="absolute right-0 bottom-0 left-0 h-0.5 bg-primary" />
            ) : null}
          </button>
        </div>
      </div>

      {tab === "fixtures" ? (
        <>
          {error ? (
            <div className="rounded-b border border-error-container bg-error-container/30 px-space-md py-space-sm text-[13px] text-on-error-container">
              {error}
            </div>
          ) : null}
          {loading && !stats ? (
            <div className="rounded-b bg-surface-container-lowest px-space-xl py-space-2xl text-[13px] text-on-surface-variant shadow-sm">
              Loading squad stats…
            </div>
          ) : (
            <MyTeamLastFixturesTable
              squadPlayers={squadPlayers}
              leaguePlayers={leaguePlayers}
              missingSlots={missingSlots}
              onSelectSlot={(pos) => openDialog(pos)}
            />
          )}
        </>
      ) : (
        <MyTeamNewsGrid
          squadPlayers={squadPlayers}
          missingSlots={missingSlots}
          onSelectSlot={(pos) => openDialog(pos)}
        />
      )}

      <SquadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        players={leaguePlayers}
        squadPlayers={squadPlayers}
        lockPosition={lockPosition}
        onAdd={(p) => addPlayer(p.id)}
        onRemove={removePlayer}
      />
      </div>
    </div>
  );
}
