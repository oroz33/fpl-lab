import { NextRequest, NextResponse } from "next/server";
import { ensureSeeded } from "@/lib/store/db";
import { aggregateRange, getMetaFromSnapshots } from "@/lib/delta/engine";
import { computeNextFixtures, loadTournamentSchedule } from "@/lib/fdr/engine";
import type { Position, StatsResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

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

  const { players, teams, baselineNote } = aggregateRange(
    store.snapshots,
    Math.min(fromGw, toGw),
    Math.max(fromGw, toGw)
  );

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

  const body: StatsResponse = {
    players: filteredPlayers,
    teams: filteredTeams,
    meta: {
      fromGw: Math.min(fromGw, toGw),
      toGw: Math.max(fromGw, toGw),
      baselineNote,
    },
  };

  return NextResponse.json(body);
}
