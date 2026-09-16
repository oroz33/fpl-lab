"use client";

import { useMemo } from "react";
import Link from "next/link";
import { GitCompareArrows, Star } from "lucide-react";
import type { PlayerRow } from "@/lib/types";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { PositionBadge } from "@/components/ui/position-badge";
import {
  AvgFdrCell,
  FixturesCell,
  averageOverallFdr,
  fixturesSortValue,
  getSyncedFixtureHorizon,
  type FixtureHorizon,
} from "@/components/ui/fixture-badges";
import { TeamAccentLabel } from "@/components/ui/team-accent";
import { cn } from "@/lib/utils";

type FavoriteProps = {
  favoritePlayerIds: Set<string>;
  onToggleFavorite: (id: string) => void;
};

const fixturesCol: ColumnDef<PlayerRow> = {
  key: "nextFixtures",
  label: "Next",
  sortable: false,
  render: (r) => <FixturesCell fixtures={r.nextFixtures} />,
  getValue: (r) => fixturesSortValue(r.nextFixtures),
};

const avgFdrCol: ColumnDef<PlayerRow> = {
  key: "avgFdr",
  label: "Avg FDR",
  numeric: true,
  digits: 2,
  heatmap: false,
  lowerIsBetter: true,
  getValue: (r) => averageOverallFdr(r.nextFixtures, getSyncedFixtureHorizon()),
  render: (r) => <AvgFdrCell fixtures={r.nextFixtures} />,
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
                "shrink-0 rounded p-0.5 transition-colors",
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
            <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-on-surface">
              {r.name}
            </span>
            <Link
              href={`/h2h?a=${encodeURIComponent(r.id)}`}
              title="Compare in H2H"
              className="shrink-0 rounded p-0.5 text-on-surface-variant opacity-0 transition-opacity hover:bg-surface-container hover:text-on-surface group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <GitCompareArrows className="h-3.5 w-3.5" />
            </Link>
          </span>
        );
      },
      getValue: (r) => r.name,
    },
    fixturesCol,
    avgFdrCol,
    {
      key: "teamShort",
      label: "Team",
      getValue: (r) => r.teamShort,
      render: (r) => (
        <TeamAccentLabel label={r.teamShort} teamId={r.teamId} />
      ),
    },
    { key: "apps", label: "Apps", numeric: true, digits: 0, heatmap: false },
    { key: "mins", label: "Mins", numeric: true, digits: 0, heatmap: false },
  ];
}

function createAttackCols(fav: FavoriteProps): ColumnDef<PlayerRow>[] {
  return [
    ...createBaseCols(fav),
    { key: "shots", label: "Shots", numeric: true, digits: 0 },
    { key: "shotsOnTarget", label: "SoT", numeric: true, digits: 0 },
    { key: "shotsInsideBox", label: "SIB", numeric: true, digits: 0 },
    { key: "bigChances", label: "BC", numeric: true, digits: 0 },
    { key: "xG", label: "xG", numeric: true },
    { key: "goals", label: "G", numeric: true, digits: 0 },
    { key: "xGI", label: "xGI", numeric: true },
    { key: "npxGI", label: "npxGI", numeric: true },
    { key: "gi", label: "GI", numeric: true, digits: 0 },
    { key: "keyPasses", label: "KP", numeric: true, digits: 0 },
    { key: "bigChancesCreated", label: "BCC", numeric: true, digits: 0 },
    { key: "xA", label: "xA", numeric: true },
    { key: "assists", label: "A", numeric: true, digits: 0 },
  ];
}

function createSetPieceCols(fav: FavoriteProps): ColumnDef<PlayerRow>[] {
  return [
    ...createBaseCols(fav),
    { key: "corners", label: "Corners", numeric: true, digits: 0 },
    { key: "freeKicksTaken", label: "FK Taken", numeric: true, digits: 0 },
    { key: "freeKickGoals", label: "FK Goals", numeric: true, digits: 0 },
    { key: "penaltyGoals", label: "Pens", numeric: true, digits: 0 },
  ];
}

function createDefendingCols(fav: FavoriteProps): ColumnDef<PlayerRow>[] {
  return [
    ...createBaseCols(fav),
    { key: "clearances", label: "Clr", numeric: true, digits: 0 },
    { key: "blocks", label: "Blk", numeric: true, digits: 0 },
    { key: "interceptions", label: "Int", numeric: true, digits: 0 },
    { key: "tackles", label: "Tck", numeric: true, digits: 0 },
    { key: "recoveries", label: "Rec", numeric: true, digits: 0 },
    {
      key: "dcPerGame",
      label: "DC/G",
      numeric: true,
      getValue: (r) => r.dcPerGame,
      render: (r) => (r.dcPerGame === null ? "—" : r.dcPerGame.toFixed(2)),
    },
    { key: "cleanSheets", label: "CS", numeric: true, digits: 0 },
    {
      key: "saves",
      label: "Saves",
      numeric: true,
      digits: 0,
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
    />
  );
}

export function SetPiecesTable({
  rows,
  favoritePlayerIds,
  onToggleFavorite,
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
    />
  );
}

export function DefendingTable({
  rows,
  favoritePlayerIds,
  onToggleFavorite,
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
    />
  );
}
