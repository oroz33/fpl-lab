"use client";

import { useMemo } from "react";
import Link from "next/link";
import { GitCompareArrows, Star } from "lucide-react";
import type { PlayerRow } from "@/lib/types";
import { XGIVarianceBadge } from "@/components/analytics/xgi-variance-badge";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { PositionBadge } from "@/components/ui/position-badge";
import {
  AvgFdrCell,
  FixturesCell,
  averagePositionFdr,
  fixturesSortValue,
  getSyncedFixtureHorizon,
  type FixtureHorizon,
} from "@/components/ui/fixture-badges";
import { TeamAccentLabel } from "@/components/ui/team-accent";
import { favoritesHeatmapTopN } from "@/lib/heatmap";
import { cn } from "@/lib/utils";

type FavoriteProps = {
  favoritePlayerIds: Set<string>;
  onToggleFavorite: (id: string) => void;
  showFavoritesOnly?: boolean;
};

const fixturesCol: ColumnDef<PlayerRow> = {
  key: "nextFixtures",
  label: "Next",
  sortable: false,
  sticky: true,
  render: (r) => <FixturesCell fixtures={r.nextFixtures} position={r.position} />,
  getValue: (r) => fixturesSortValue(r.nextFixtures),
};

const avgFdrCol: ColumnDef<PlayerRow> = {
  key: "avgFdr",
  label: "Avg FDR",
  sticky: true,
  stickyWidth: 88,
  numeric: true,
  digits: 2,
  heatmap: false,
  lowerIsBetter: true,
  getValue: (r) =>
    averagePositionFdr(r.nextFixtures, getSyncedFixtureHorizon(), r.position),
  render: (r) => <AvgFdrCell fixtures={r.nextFixtures} position={r.position} />,
};

function createBaseCols({
  favoritePlayerIds,
  onToggleFavorite,
}: FavoriteProps): ColumnDef<PlayerRow>[] {
  return [
    {
      key: "name",
      label: "Player",
      sticky: true,
      stickyWidth: 210,
      render: (r) => {
        const favorited = favoritePlayerIds.has(r.id);
        return (
          <span className="inline-flex w-full min-w-0 items-center gap-space-sm">
            <button
              type="button"
              title={favorited ? "Remove favorite" : "Add favorite"}
              aria-label={favorited ? "Remove favorite" : "Add favorite"}
              aria-pressed={favorited}
              className={cn(
                "shrink-0 rounded p-0.5 transition-colors max-md:inline-flex max-md:min-h-11 max-md:min-w-11 max-md:items-center max-md:justify-center",
                favorited
                  ? "text-amber-500 hover:text-amber-400"
                  : "text-on-surface-variant/50 hover:text-on-surface-variant"
              )}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFavorite(r.id);
              }}
            >
              <Star
                className={cn("h-3.5 w-3.5", favorited && "fill-amber-500")}
              />
            </button>
            <PositionBadge position={r.position} />
            <span
              className="min-w-0 flex-1 truncate text-[14px] font-semibold text-on-surface"
              title={r.name}
            >
              {r.name}
            </span>
            <Link
              href={`/h2h?a=${encodeURIComponent(r.id)}`}
              title="Compare in H2H"
              className="hidden shrink-0 rounded p-0.5 text-on-surface-variant opacity-0 transition-opacity hover:bg-surface-container hover:text-on-surface group-hover:opacity-100 md:inline-flex"
              onClick={(e) => e.stopPropagation()}
            >
              <GitCompareArrows className="h-3.5 w-3.5" />
            </Link>
          </span>
        );
      },
      getValue: (r) => r.name,
    },
    {
      key: "teamShort",
      label: "Team",
      sticky: true,
      stickyWidth: 88,
      getValue: (r) => r.teamShort,
      render: (r) => (
        <TeamAccentLabel label={r.teamShort} teamId={r.teamId} />
      ),
    },
    fixturesCol,
    avgFdrCol,
    {
      key: "apps",
      label: "Apps",
      numeric: true,
      digits: 0,
      heatmap: false,
      mobilePriority: "key",
    },
    {
      key: "mins",
      label: "Mins",
      numeric: true,
      digits: 0,
      heatmap: false,
      mobilePriority: "secondary",
    },
  ];
}

function createAttackCols(fav: FavoriteProps): ColumnDef<PlayerRow>[] {
  return [
    ...createBaseCols(fav),
    {
      key: "shots",
      label: "Shots",
      numeric: true,
      digits: 0,
      mobilePriority: "secondary",
    },
    {
      key: "shotsOnTarget",
      label: "SoT",
      numeric: true,
      digits: 0,
      mobilePriority: "secondary",
    },
    {
      key: "shotsInsideBox",
      label: "SIB",
      numeric: true,
      digits: 0,
      mobilePriority: "secondary",
    },
    {
      key: "bigChances",
      label: "BC",
      numeric: true,
      digits: 0,
      mobilePriority: "secondary",
    },
    { key: "xG", label: "xG", numeric: true, digits: 2, mobilePriority: "key" },
    {
      key: "goals",
      label: "G",
      numeric: true,
      digits: 0,
      mobilePriority: "key",
    },
    {
      key: "xGI",
      label: "xGI",
      numeric: true,
      digits: 2,
      mobilePriority: "key",
    },
    {
      key: "npxGI",
      label: "npxGI",
      numeric: true,
      digits: 2,
      mobilePriority: "secondary",
    },
    {
      key: "gi",
      label: "GI",
      numeric: true,
      digits: 0,
      mobilePriority: "secondary",
    },
    {
      key: "xGiVariance",
      label: "Δ xGI",
      numeric: true,
      digits: 2,
      heatmap: false,
      mobilePriority: "key",
      getValue: (r) => r.xGiVariance ?? r.gi - r.xGI,
      render: (r) => (
        <XGIVarianceBadge
          variance={r.xGiVariance}
          actualReturns={r.actualReturns}
          gi={r.gi}
          xGI={r.xGI}
          status={r.regressionStatus}
        />
      ),
    },
    {
      key: "keyPasses",
      label: "KP",
      numeric: true,
      digits: 0,
      mobilePriority: "secondary",
    },
    {
      key: "bigChancesCreated",
      label: "BCC",
      numeric: true,
      digits: 0,
      mobilePriority: "secondary",
    },
    { key: "xA", label: "xA", numeric: true, digits: 2, mobilePriority: "key" },
    {
      key: "assists",
      label: "A",
      numeric: true,
      digits: 0,
      mobilePriority: "key",
    },
  ];
}

function createSetPieceCols(fav: FavoriteProps): ColumnDef<PlayerRow>[] {
  return [
    ...createBaseCols(fav),
    {
      key: "corners",
      label: "Corners",
      numeric: true,
      digits: 0,
      mobilePriority: "key",
    },
    {
      key: "freeKicksTaken",
      label: "FK Taken",
      numeric: true,
      digits: 0,
      mobilePriority: "key",
    },
    {
      key: "freeKickGoals",
      label: "FK Goals",
      numeric: true,
      digits: 0,
      mobilePriority: "secondary",
    },
    {
      key: "penaltyGoals",
      label: "Pens",
      numeric: true,
      digits: 0,
      mobilePriority: "key",
    },
  ];
}

function createDefendingCols(fav: FavoriteProps): ColumnDef<PlayerRow>[] {
  return [
    ...createBaseCols(fav),
    {
      key: "clearances",
      label: "Clr",
      numeric: true,
      digits: 0,
      mobilePriority: "secondary",
    },
    {
      key: "blocks",
      label: "Blk",
      numeric: true,
      digits: 0,
      mobilePriority: "secondary",
    },
    {
      key: "interceptions",
      label: "Int",
      numeric: true,
      digits: 0,
      mobilePriority: "secondary",
    },
    {
      key: "tackles",
      label: "Tck",
      numeric: true,
      digits: 0,
      mobilePriority: "key",
    },
    {
      key: "recoveries",
      label: "Rec",
      numeric: true,
      digits: 0,
      mobilePriority: "key",
    },
    {
      key: "dcPerGame",
      label: "DC/G",
      numeric: true,
      digits: 2,
      mobilePriority: "key",
      getValue: (r) => r.dcPerGame,
      render: (r) => (r.dcPerGame === null ? "—" : r.dcPerGame.toFixed(2)),
    },
    {
      key: "cleanSheets",
      label: "CS",
      numeric: true,
      digits: 0,
      mobilePriority: "key",
    },
    {
      key: "saves",
      label: "Saves",
      numeric: true,
      digits: 0,
      mobilePriority: "secondary",
      getValue: (r) => r.saves,
      render: (r) => (r.saves === null ? "—" : String(r.saves)),
    },
  ];
}

type PlayerTableProps = FavoriteProps & {
  rows: PlayerRow[];
  nextHorizon: FixtureHorizon;
  onNextHorizonChange: (horizon: FixtureHorizon) => void;
  onFiltersChange?: (
    filters: import("@/components/ui/data-table").ActiveColumnFilter[]
  ) => void;
};

export function AttackTable({
  rows,
  favoritePlayerIds,
  onToggleFavorite,
  showFavoritesOnly,
  nextHorizon,
  onNextHorizonChange,
  onFiltersChange,
}: PlayerTableProps) {
  const columns = useMemo(
    () => createAttackCols({ favoritePlayerIds, onToggleFavorite }),
    [favoritePlayerIds, onToggleFavorite]
  );
  return (
    <DataTable
      columns={columns}
      rows={rows}
      horizon={nextHorizon}
      onHorizonChange={onNextHorizonChange}
      onFiltersChange={onFiltersChange}
      heatmapTopNOverride={
        showFavoritesOnly ? favoritesHeatmapTopN(rows.length) : undefined
      }
    />
  );
}

export function SetPiecesTable({
  rows,
  favoritePlayerIds,
  onToggleFavorite,
  showFavoritesOnly,
  nextHorizon,
  onNextHorizonChange,
  onFiltersChange,
}: PlayerTableProps) {
  const columns = useMemo(
    () => createSetPieceCols({ favoritePlayerIds, onToggleFavorite }),
    [favoritePlayerIds, onToggleFavorite]
  );
  return (
    <DataTable
      columns={columns}
      rows={rows}
      horizon={nextHorizon}
      onHorizonChange={onNextHorizonChange}
      onFiltersChange={onFiltersChange}
      heatmapTopNOverride={
        showFavoritesOnly ? favoritesHeatmapTopN(rows.length) : undefined
      }
    />
  );
}

export function DefendingTable({
  rows,
  favoritePlayerIds,
  onToggleFavorite,
  showFavoritesOnly,
  nextHorizon,
  onNextHorizonChange,
  onFiltersChange,
}: PlayerTableProps) {
  const columns = useMemo(
    () => createDefendingCols({ favoritePlayerIds, onToggleFavorite }),
    [favoritePlayerIds, onToggleFavorite]
  );
  return (
    <DataTable
      columns={columns}
      rows={rows}
      horizon={nextHorizon}
      onHorizonChange={onNextHorizonChange}
      onFiltersChange={onFiltersChange}
      heatmapTopNOverride={
        showFavoritesOnly ? favoritesHeatmapTopN(rows.length) : undefined
      }
    />
  );
}
