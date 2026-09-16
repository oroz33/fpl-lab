"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Lock, Shield, Star, Swords, Target, Users, X } from "lucide-react";
import { useAppShell } from "@/components/layout/AppShell";
import { GameweekRange } from "@/components/filters/GameweekRange";
import { PositionFilter } from "@/components/filters/PositionFilter";
import { TeamFilter } from "@/components/filters/TeamFilter";
import { SearchBar } from "@/components/filters/SearchBar";
import { InsightCards } from "@/components/insights/InsightCards";
import {
  AttackTable,
  DefendingTable,
  SetPiecesTable,
} from "@/components/players/PlayerTables";
import {
  TeamDefensiveTable,
  TeamOffensiveTable,
} from "@/components/teams/TeamTables";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ActiveColumnFilter } from "@/components/ui/data-table";
import type { MetaResponse, Position, StatsResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Dashboard() {
  const { registerIngestHandler } = useAppShell();
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fromGw, setFromGw] = useState(1);
  const [toGw, setToGw] = useState(3);
  const [position, setPosition] = useState<Position | "All">("All");
  const [teams, setTeams] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"players" | "teams">("players");
  const [refreshKey, setRefreshKey] = useState(0);
  const [columnFilters, setColumnFilters] = useState<ActiveColumnFilter[]>([]);
  const [filterEpoch, setFilterEpoch] = useState(0);
  const [favoritePlayerIds, setFavoritePlayerIds] = useState(
    () => new Set<string>()
  );
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const loadMeta = useCallback(async () => {
    const res = await fetch("/api/meta");
    const data = (await res.json()) as MetaResponse;
    setMeta(data);
    setToGw((prev) => Math.min(Math.max(prev, data.maxGameweek), data.maxGameweek));
  }, []);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        from: String(fromGw),
        to: String(toGw),
        position,
        q: query,
      });
      if (teams.length) params.set("teams", teams.join(","));
      const res = await fetch(`/api/stats?${params}`);
      if (!res.ok) throw new Error("Failed to load stats");
      const data = (await res.json()) as StatsResponse;
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [fromGw, toGw, position, teams, query]);

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

  const maxGw = meta?.maxGameweek ?? 3;

  const positionCounts = useMemo(() => {
    const players = stats?.players ?? [];
    const counts: Partial<Record<Position | "All", number>> = {
      All: players.length,
      GKP: 0,
      DEF: 0,
      MID: 0,
      FWD: 0,
    };
    for (const p of players) {
      counts[p.position] = (counts[p.position] ?? 0) + 1;
    }
    return counts;
  }, [stats?.players]);

  const toggleFavorite = useCallback((id: string) => {
    setFavoritePlayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const displayPlayers = useMemo(() => {
    const players = stats?.players ?? [];
    if (!showFavoritesOnly) return players;
    return players.filter((p) => favoritePlayerIds.has(p.id));
  }, [stats?.players, showFavoritesOnly, favoritePlayerIds]);

  const entityToggle = (
    <div className="inline-flex gap-1 rounded-xl bg-surface-container-low p-1 shadow-sm">
      <button
        type="button"
        onClick={() => setView("players")}
        className={cn(
          "flex items-center gap-2 rounded-lg px-space-xl py-1.5 text-[14px] font-semibold transition-all",
          view === "players"
            ? "bg-primary text-on-primary shadow-sm"
            : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
        )}
      >
        <Users className="h-4 w-4" />
        Players
      </button>
      <button
        type="button"
        onClick={() => setView("teams")}
        className={cn(
          "flex items-center gap-2 rounded-lg px-space-xl py-1.5 text-[14px] font-semibold transition-all",
          view === "teams"
            ? "bg-primary text-on-primary shadow-sm"
            : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
        )}
      >
        <Shield className="h-4 w-4" />
        Teams
      </button>
    </div>
  );

  const activeFilterChips =
    columnFilters.length > 0 ? (
      <div className="ml-space-md hidden items-center gap-1.5 lg:flex">
        <span className="text-[10px] font-medium tracking-wider text-on-surface-variant uppercase">
          Active Filters:
        </span>
        {columnFilters.map((f) => (
          <span
            key={`${f.key}-${f.value}`}
            className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2 py-0.5 font-data-mono text-[11px] text-on-surface"
          >
            <span>{f.label}</span>
            <button
              type="button"
              className="flex items-center transition-colors hover:text-error"
              onClick={() => {
                setColumnFilters([]);
                setFilterEpoch((n) => n + 1);
              }}
              title="Clear column filters"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
    ) : null;

  return (
    <div className="mx-auto w-full max-w-[1720px] space-y-space-md px-space-xl py-space-lg">
      <div className="space-y-space-md rounded-xl bg-surface-container-lowest p-space-lg shadow-[0_2px_12px_rgba(11,28,48,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-space-md xl:flex-nowrap">
          <div className="flex flex-wrap items-center gap-space-md">
            <GameweekRange
              from={fromGw}
              to={toGw}
              max={Math.max(maxGw, 3)}
              onChange={(f, t) => {
                setFromGw(f);
                setToGw(t);
              }}
            />
            <PositionFilter
              value={position}
              onChange={setPosition}
              counts={positionCounts}
            />
            <TeamFilter
              teams={meta?.teams ?? []}
              selected={teams}
              onChange={setTeams}
            />
            {view === "players" && (
              <button
                type="button"
                title="Show Favorites Only"
                onClick={() => setShowFavoritesOnly((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-space-md py-1 text-[11px] font-semibold tracking-[0.02em] uppercase transition-all",
                  showFavoritesOnly
                    ? "bg-primary text-on-primary shadow-sm"
                    : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                )}
              >
                <Star
                  className={cn(
                    "h-3.5 w-3.5",
                    showFavoritesOnly && "fill-current"
                  )}
                />
                <span>Favorites</span>
                <span
                  className={cn(
                    "rounded px-1 py-0.5 font-data-mono text-[10px]",
                    showFavoritesOnly
                      ? "bg-surface-container-highest/20"
                      : "text-on-surface-variant/70"
                  )}
                >
                  {favoritePlayerIds.size}
                </span>
              </button>
            )}
          </div>

          <div className="flex w-full items-center justify-between gap-space-md xl:w-auto xl:justify-end">
            <SearchBar value={query} onChange={setQuery} />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 text-[10px] font-medium text-on-surface-variant">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 font-medium text-on-tertiary-container">
              <Lock className="h-[13px] w-[13px]" />
              GW1–GW3 are an inseparable baseline block from the first cumulative Opta
              upload.
            </span>
            {stats?.meta.baselineNote && (
              <>
                <span className="text-on-surface-variant/40">•</span>
                <span>{stats.meta.baselineNote}</span>
              </>
            )}
          </div>
          <div className="hidden items-center gap-space-lg font-data-mono text-[11px] sm:flex">
            <span>
              Active Sample:{" "}
              <strong className="font-semibold text-on-surface">
                {loading
                  ? "…"
                  : view === "players"
                    ? `${displayPlayers.length} players`
                    : `${stats?.teams.length ?? 0} teams`}
              </strong>
            </span>
            <span className="text-on-surface-variant/40">|</span>
            <span>
              Per 90 Multiplier: <strong>OFF</strong>
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-error/30 bg-error-container px-3 py-2 text-sm text-on-error-container">
          {error}
        </div>
      )}

      {view === "players" ? (
        <Tabs defaultValue="attack" key={`players-${filterEpoch}`}>
          <div className="flex flex-col justify-between gap-space-md pt-space-xs md:flex-row md:items-end">
            <div className="flex flex-wrap items-center gap-space-md">
              {entityToggle}
              {activeFilterChips}
            </div>
            <TabsList>
              <TabsTrigger value="attack">
                <Swords className="h-4 w-4" />
                Attack
              </TabsTrigger>
              <TabsTrigger value="setpieces">
                <Target className="h-4 w-4" />
                Set Pieces
              </TabsTrigger>
              <TabsTrigger value="defending">
                <Shield className="h-4 w-4" />
                Defending
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="attack">
            <AttackTable
              rows={displayPlayers}
              favoritePlayerIds={favoritePlayerIds}
              onToggleFavorite={toggleFavorite}
              onFiltersChange={setColumnFilters}
            />
          </TabsContent>
          <TabsContent value="setpieces">
            <SetPiecesTable
              rows={displayPlayers}
              favoritePlayerIds={favoritePlayerIds}
              onToggleFavorite={toggleFavorite}
              onFiltersChange={setColumnFilters}
            />
          </TabsContent>
          <TabsContent value="defending">
            <DefendingTable
              rows={displayPlayers}
              favoritePlayerIds={favoritePlayerIds}
              onToggleFavorite={toggleFavorite}
              onFiltersChange={setColumnFilters}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <Tabs defaultValue="defensive" key={`teams-${filterEpoch}`}>
          <div className="flex flex-col justify-between gap-space-md pt-space-xs md:flex-row md:items-end">
            <div className="flex flex-wrap items-center gap-space-md">
              {entityToggle}
              {activeFilterChips}
            </div>
            <TabsList>
              <TabsTrigger value="defensive">
                <Shield className="h-4 w-4" />
                Defensive
              </TabsTrigger>
              <TabsTrigger value="offensive">
                <Swords className="h-4 w-4" />
                Offensive
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="defensive">
            <TeamDefensiveTable
              rows={stats?.teams ?? []}
              onFiltersChange={setColumnFilters}
            />
          </TabsContent>
          <TabsContent value="offensive">
            <TeamOffensiveTable
              rows={stats?.teams ?? []}
              onFiltersChange={setColumnFilters}
            />
          </TabsContent>
        </Tabs>
      )}

      {view === "players" && (
        <InsightCards
          players={stats?.players ?? []}
          fromGw={fromGw}
          toGw={toGw}
        />
      )}
    </div>
  );
}
