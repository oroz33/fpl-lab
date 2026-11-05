import type {
  CumulativeSnapshot,
  FixtureTrackerResponse,
  FixtureTrackerTeamRow,
  TrackerFixtureCell,
} from "@/lib/types";
import {
  applyBands,
  buildBandFns,
  buildTeamMetrics,
  flattenScheduleMatches,
  rateFixtureRaw,
  type FixtureRawRating,
  type ScheduleMatch,
  type TournamentSchedule,
} from "@/lib/fdr/engine";

const SEASON_END_GW = 38;
const EXPECTED_TEAM_COUNT = 20;

function matchKickoffMs(match: ScheduleMatch): number {
  const datePart = match.date.replace(/Z$/i, "");
  const timePart = match.time || "00:00:00Z";
  return Date.parse(`${datePart}T${timePart}`);
}

/**
 * Highest throughGameweek where all 20 teams have both SeasonStats and ExpectedGoals.
 * Falls back to max throughGameweek when no complete GW exists.
 */
export function getLatestCompleteGameweek(snapshots: CumulativeSnapshot[]): number {
  if (snapshots.length === 0) return 0;

  const byGw = new Map<number, CumulativeSnapshot[]>();
  for (const s of snapshots) {
    const list = byGw.get(s.throughGameweek) ?? [];
    list.push(s);
    byGw.set(s.throughGameweek, list);
  }

  let latest = 0;
  for (const [gw, list] of byGw) {
    const complete = list.filter((s) => s.seasonStatsRaw != null && s.expectedGoalsRaw != null);
    const teamIds = new Set(complete.map((s) => s.teamId));
    if (teamIds.size >= EXPECTED_TEAM_COUNT && gw > latest) {
      latest = gw;
    }
  }

  if (latest > 0) return latest;
  return Math.max(...snapshots.map((s) => s.throughGameweek), 0);
}

/**
 * Assign league-wide gameweeks: chronological greedy pack so a team
 * never appears twice in the same GW (DGW only if later rules allow).
 */
export function assignMatchGameweeks(
  schedule: TournamentSchedule
): Map<string, number> {
  const matches = flattenScheduleMatches(schedule).sort(
    (a, b) => matchKickoffMs(a) - matchKickoffMs(b)
  );

  const teamGw = new Map<string, Set<number>>();
  const matchGw = new Map<string, number>();

  for (const match of matches) {
    let gw = 1;
    for (;;) {
      const home = teamGw.get(match.homeContestantId) ?? new Set();
      const away = teamGw.get(match.awayContestantId) ?? new Set();
      if (!home.has(gw) && !away.has(gw)) break;
      gw += 1;
    }

    for (const tid of [match.homeContestantId, match.awayContestantId]) {
      let set = teamGw.get(tid);
      if (!set) {
        set = new Set();
        teamGw.set(tid, set);
      }
      set.add(gw);
    }
    matchGw.set(match.id, gw);
  }

  return matchGw;
}

function teamCodeFromMatch(match: ScheduleMatch, teamId: string): string {
  if (match.homeContestantId === teamId) {
    return match.homeContestantOptaSymId || match.homeContestantCode || "UNK";
  }
  return match.awayContestantOptaSymId || match.awayContestantCode || "UNK";
}

function teamNameFromMatch(match: ScheduleMatch, teamId: string): string {
  if (match.homeContestantId === teamId) {
    return match.homeContestantName || "Unknown";
  }
  return match.awayContestantName || "Unknown";
}

export function buildFixtureMatrix(
  snapshots: CumulativeSnapshot[],
  schedule: TournamentSchedule
): FixtureTrackerResponse {
  const latestUploadedGw = getLatestCompleteGameweek(snapshots);
  const startGw = Math.min(Math.max(latestUploadedGw + 1, 1), SEASON_END_GW);
  const metrics = buildTeamMetrics(snapshots);
  const matchGw = assignMatchGameweeks(schedule);
  const matches = flattenScheduleMatches(schedule);

  const snapshotNames = new Map<string, string>();
  for (const s of snapshots) {
    snapshotNames.set(s.teamId, s.teamName);
  }

  const teamMeta = new Map<string, { teamCode: string; teamName: string }>();
  type PendingCell = {
    teamId: string;
    gw: number;
    opponentCode: string;
    isHome: boolean;
    raw: FixtureRawRating;
  };
  const pendingCells: PendingCell[] = [];

  for (const match of matches) {
    const gw = matchGw.get(match.id);
    if (gw == null || gw < 1 || gw > SEASON_END_GW) continue;

    const sides: { teamId: string; opponentId: string; isHome: boolean; opponentCode: string }[] =
      [
        {
          teamId: match.homeContestantId,
          opponentId: match.awayContestantId,
          isHome: true,
          opponentCode:
            match.awayContestantOptaSymId || match.awayContestantCode || "UNK",
        },
        {
          teamId: match.awayContestantId,
          opponentId: match.homeContestantId,
          isHome: false,
          opponentCode:
            match.homeContestantOptaSymId || match.homeContestantCode || "UNK",
        },
      ];

    for (const side of sides) {
      if (!teamMeta.has(side.teamId)) {
        teamMeta.set(side.teamId, {
          teamCode: teamCodeFromMatch(match, side.teamId),
          teamName:
            snapshotNames.get(side.teamId) || teamNameFromMatch(match, side.teamId),
        });
      }

      pendingCells.push({
        teamId: side.teamId,
        gw,
        opponentCode: side.opponentCode,
        isHome: side.isHome,
        raw: rateFixtureRaw(side.teamId, side.opponentId, side.isHome, metrics),
      });
    }
  }

  const bands = buildBandFns(pendingCells.map((c) => c.raw));

  const byTeamGw = new Map<string, Map<number, TrackerFixtureCell[]>>();
  for (const pending of pendingCells) {
    const rated = applyBands(pending.raw, bands);
    let gwMap = byTeamGw.get(pending.teamId);
    if (!gwMap) {
      gwMap = new Map();
      byTeamGw.set(pending.teamId, gwMap);
    }
    const cell: TrackerFixtureCell = {
      opponentCode: pending.opponentCode,
      isHome: pending.isHome,
      fdrOff: rated.fdrOff,
      fdrDef: rated.fdrDef,
      fdrOffRaw: rated.fdrOffRaw,
      fdrDefRaw: rated.fdrDefRaw,
      fdrOverallRaw: rated.fdrOverallRaw,
    };
    const existing = gwMap.get(pending.gw) ?? [];
    existing.push(cell);
    gwMap.set(pending.gw, existing);
  }

  const teams: FixtureTrackerTeamRow[] = [...teamMeta.entries()]
    .map(([teamId, meta]) => {
      const gwMap = byTeamGw.get(teamId) ?? new Map();
      const byGw: Record<number, TrackerFixtureCell[]> = {};
      for (let gw = 1; gw <= SEASON_END_GW; gw++) {
        byGw[gw] = gwMap.get(gw) ?? [];
      }
      return {
        teamId,
        teamCode: meta.teamCode,
        teamName: meta.teamName,
        byGw,
      };
    })
    .sort((a, b) => a.teamName.localeCompare(b.teamName));

  return {
    latestUploadedGw,
    startGw,
    endGw: SEASON_END_GW,
    teams,
  };
}
