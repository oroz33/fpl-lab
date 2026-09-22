import { NextRequest, NextResponse } from "next/server";
import { ensureSeeded, getStorageMode } from "@/lib/store/db";
import { aggregateRange, getMetaFromSnapshots } from "@/lib/delta/engine";
import { computeNextFixtures, loadTournamentSchedule } from "@/lib/fdr/engine";
import type { Position, StatsResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

function snapshotProbe(
  snapshots: {
    throughGameweek?: unknown;
    shortName?: string;
    players?: unknown[];
    seasonStatsRaw?: unknown;
    expectedGoalsRaw?: unknown;
    teamName?: string;
  }[]
) {
  const gws = snapshots.map((s) => s.throughGameweek);
  const playerCounts = snapshots.map((s) =>
    Array.isArray(s.players) ? s.players.length : -1
  );
  const unk = snapshots.filter((s) => !s.shortName || s.shortName === "UNK").length;
  return {
    count: snapshots.length,
    gws,
    gwTypes: gws.map((g) => (g === null ? "null" : typeof g)),
    playerCounts,
    emptyPlayerSnapshots: playerCounts.filter((n) => n === 0).length,
    missingPlayerField: playerCounts.filter((n) => n < 0).length,
    unkShortName: unk,
    withSeasonRaw: snapshots.filter((s) => s.seasonStatsRaw != null).length,
    withXgRaw: snapshots.filter((s) => s.expectedGoalsRaw != null).length,
    sample: snapshots.slice(0, 3).map((s) => ({
      team: s.teamName,
      gw: s.throughGameweek,
      short: s.shortName,
      players: Array.isArray(s.players) ? s.players.length : null,
    })),
  };
}

export async function GET(req: NextRequest) {
  const store = await ensureSeeded();
  const { searchParams } = req.nextUrl;

  const meta = getMetaFromSnapshots(store.snapshots);
  const fromGw = Number(searchParams.get("from") ?? 1);
  const toGw = Number(searchParams.get("to") ?? meta.maxGameweek);
  const position = (searchParams.get("position") ?? "All") as Position | "All";
  const teamIds = (searchParams.get("teams") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();

  const rangeFrom = Math.min(fromGw, toGw);
  const rangeTo = Math.max(fromGw, toGw);
  const { players, teams, baselineNote } = aggregateRange(
    store.snapshots,
    rangeFrom,
    rangeTo
  );

  // #region agent log
  const probe = snapshotProbe(store.snapshots);
  const debugPayload = {
    sessionId: "277348",
    runId: "post-fix",
    hypothesisId: "A,B,C,D,E",
    location: "app/api/stats/route.ts:GET",
    message: "stats aggregate probe",
    data: {
      storageMode: getStorageMode(),
      fromGw: rangeFrom,
      toGw: rangeTo,
      probe,
      aggregatePlayers: players.length,
      aggregateTeams: teams.length,
      baselineNote: baselineNote ?? null,
    },
    timestamp: Date.now(),
  };
  fetch("http://127.0.0.1:7511/ingest/c5e4f916-7c09-4e65-9837-7460f44881ef", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "277348",
    },
    body: JSON.stringify(debugPayload),
  }).catch(() => {});
  // #endregion

  const schedule = await loadTournamentSchedule();
  const nextByTeam = computeNextFixtures(store.snapshots, schedule, 5);
  const playersWithFdr = players.map((p) => ({
    ...p,
    nextFixtures: nextByTeam.get(p.teamId) ?? [],
  }));
  const teamsWithFdr = teams.map((t) => ({
    ...t,
    nextFixtures: nextByTeam.get(t.id) ?? [],
  }));

  let filteredPlayers = playersWithFdr;
  if (position !== "All") {
    filteredPlayers = filteredPlayers.filter((p) => p.position === position);
  }
  if (teamIds.length > 0) {
    filteredPlayers = filteredPlayers.filter(
      (p) => teamIds.includes(p.teamId) || teamIds.includes(p.teamShort)
    );
  }
  if (q) {
    filteredPlayers = filteredPlayers.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.team.toLowerCase().includes(q) ||
        p.teamShort.toLowerCase().includes(q)
    );
  }

  let filteredTeams = teamsWithFdr;
  if (teamIds.length > 0) {
    filteredTeams = filteredTeams.filter(
      (t) => teamIds.includes(t.id) || teamIds.includes(t.shortName)
    );
  }
  if (q) {
    filteredTeams = filteredTeams.filter(
      (t) =>
        t.name.toLowerCase().includes(q) || t.shortName.toLowerCase().includes(q)
    );
  }

  const body: StatsResponse & { _debug?: unknown } = {
    players: filteredPlayers,
    teams: filteredTeams,
    meta: {
      fromGw: rangeFrom,
      toGw: rangeTo,
      baselineNote,
    },
  };

  if (searchParams.get("debug") === "1") {
    body._debug = debugPayload.data;
  }

  return NextResponse.json(body);
}
