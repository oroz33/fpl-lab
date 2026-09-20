"use client";

import type { TeamRow } from "@/lib/types";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import {
  AvgFdrCell,
  FixturesCell,
  averageOverallFdr,
  fixturesSortValue,
  getSyncedFixtureHorizon,
} from "@/components/ui/fixture-badges";
import { TeamAccentLabel } from "@/components/ui/team-accent";
import { cn } from "@/lib/utils";

function formatDelta(value: number): string {
  if (Object.is(value, -0) || value === 0) return "0.00";
  const abs = Math.abs(value).toFixed(2);
  return value > 0 ? `+${abs}` : `−${abs}`;
}

function renderDelta(value: number) {
  const tone =
    value > 0 ? "text-emerald-700" : value < 0 ? "text-rose-700" : "text-slate-500";
  return <span className={cn("font-semibold tabular-nums", tone)}>{formatDelta(value)}</span>;
}

const fixturesCol: ColumnDef<TeamRow> = {
  key: "nextFixtures",
  label: "Next",
  sortable: false,
  sticky: true,
  render: (r) => <FixturesCell fixtures={r.nextFixtures} />,
  getValue: (r) => fixturesSortValue(r.nextFixtures),
};

const avgFdrCol: ColumnDef<TeamRow> = {
  key: "avgFdr",
  label: "Avg FDR",
  sticky: true,
  stickyWidth: 88,
  numeric: true,
  digits: 2,
  heatmap: false,
  lowerIsBetter: true,
  getValue: (r) => averageOverallFdr(r.nextFixtures, getSyncedFixtureHorizon()),
  render: (r) => <AvgFdrCell fixtures={r.nextFixtures} />,
};

const teamCol: ColumnDef<TeamRow> = {
  key: "name",
  label: "Team",
  sticky: true,
  stickyWidth: 140,
  getValue: (r) => r.name,
  render: (r) => <TeamAccentLabel label={r.name} teamId={r.id} />,
};

const defensiveCols: ColumnDef<TeamRow>[] = [
  teamCol,
  fixturesCol,
  avgFdrCol,
  { key: "xGC", label: "xGC", numeric: true },
  { key: "goalsConceded", label: "GC", numeric: true, digits: 0 },
  {
    key: "deltaGC",
    label: "ΔGC",
    numeric: true,
    getValue: (r) => r.deltaGC,
    render: (r) => renderDelta(r.deltaGC),
  },
  { key: "xCS", label: "xCS", numeric: true },
  { key: "cleanSheets", label: "CS", numeric: true, digits: 0 },
  {
    key: "deltaCS",
    label: "ΔCS",
    numeric: true,
    getValue: (r) => r.deltaCS,
    render: (r) => renderDelta(r.deltaCS),
  },
];

const offensiveCols: ColumnDef<TeamRow>[] = [
  teamCol,
  fixturesCol,
  avgFdrCol,
  { key: "xG", label: "xG", numeric: true },
  { key: "goals", label: "G", numeric: true, digits: 0 },
  {
    key: "deltaG",
    label: "ΔG",
    numeric: true,
    getValue: (r) => r.deltaG,
    render: (r) => renderDelta(r.deltaG),
  },
];

export function TeamDefensiveTable({
  rows,
  onFiltersChange,
}: {
  rows: TeamRow[];
  onFiltersChange?: (filters: import("@/components/ui/data-table").ActiveColumnFilter[]) => void;
}) {
  return <DataTable columns={defensiveCols} rows={rows} onFiltersChange={onFiltersChange} />;
}

export function TeamOffensiveTable({
  rows,
  onFiltersChange,
}: {
  rows: TeamRow[];
  onFiltersChange?: (filters: import("@/components/ui/data-table").ActiveColumnFilter[]) => void;
}) {
  return <DataTable columns={offensiveCols} rows={rows} onFiltersChange={onFiltersChange} />;
}
