import { promises as fs } from "fs";
import path from "path";
import type { CumulativeSnapshot, FdrScore, NextFixture } from "@/lib/types";

export interface ScheduleMatch {
  id: string;
  date: string;
  time: string;
  homeContestantId: string;
  awayContestantId: string;
  homeContestantOptaSymId: string;
  awayContestantOptaSymId: string;
  homeContestantCode?: string;
  awayContestantCode?: string;
  homeContestantName?: string;
  awayContestantName?: string;
}

export interface TournamentSchedule {
  tournamentCalendar?: { startDate?: string };
  matchDate: { date: string; match?: ScheduleMatch[] }[];
}

export type VenueMetrics = { xGPer90: number; xGCPer90: number };

export type TeamMetrics = VenueMetrics & {
  home: VenueMetrics;
  away: VenueMetrics;
};

/** Strong home/away shift so elite away ≈5 and elite home ≈4. */
const VENUE_DELTA = 0.9;

/** Prefer venue bucket only when it has at least this many matches. */
const MIN_VENUE_GAMES = 3;

const XG_QUALIFIER_ID = 321;

type EgMatchEvent = {
  contestantId?: string;
  qualifier?: Array<{ qualifierId?: number | string; value?: string | number }>;
};

type EgMatch = {
  id?: string;
  location?: string;
  oppositionContestantId?: string;
  date?: string;
  event?: EgMatchEvent[];
};

export type FixtureRawRating = {
  fdrOffRaw: number;
  fdrDefRaw: number;
  fdrOverallRaw: number;
};

export type FixtureRating = FixtureRawRating & {
  fdrOff: FdrScore;
  fdrDef: FdrScore;
  fdrOverall: FdrScore;
};

/** League reference arrays for absolute opponent ranking (sorted ascending). */
export type LeagueScales = {
  seasonXg: number[];
  seasonNegXgc: number[];
};

export function clampRound(value: number): FdrScore {
  return Math.min(5, Math.max(1, Math.round(value))) as FdrScore;
}

function clampContinuous(value: number): number {
  return Math.min(5, Math.max(1, value));
}

function matchKickoffMs(match: ScheduleMatch): number {
  const datePart = match.date.replace(/Z$/i, "");
  const timePart = match.time || "00:00:00Z";
  return Date.parse(`${datePart}T${timePart}`);
}

function extractStoreMatchDates(snapshots: CumulativeSnapshot[]): number[] {
  const dates: number[] = [];
  for (const snapshot of snapshots) {
    const raw = snapshot.expectedGoalsRaw as { match?: { date?: string }[] } | undefined;
    for (const match of raw?.match ?? []) {
      if (!match.date) continue;
      const ms = Date.parse(match.date);
      if (Number.isFinite(ms)) dates.push(ms);
    }
  }
  return dates;
}

export function getStoreCutoffMs(
  snapshots: CumulativeSnapshot[],
  schedule: TournamentSchedule
): number {
  const storeDates = extractStoreMatchDates(snapshots);
  if (storeDates.length > 0) return Math.max(...storeDates);

  const start = schedule.tournamentCalendar?.startDate;
  if (start) {
    const ms = Date.parse(start.replace(/Z$/i, "") + "T00:00:00Z");
    if (Number.isFinite(ms)) return ms - 1;
  }

  const flattened = flattenScheduleMatches(schedule);
  if (flattened.length === 0) return 0;
  return Math.min(...flattened.map(matchKickoffMs)) - 1;
}

export function flattenScheduleMatches(schedule: TournamentSchedule): ScheduleMatch[] {
  const out: ScheduleMatch[] = [];
  for (const day of schedule.matchDate ?? []) {
    for (const match of day.match ?? []) {
      if (!match?.homeContestantId || !match?.awayContestantId) continue;
      out.push(match);
    }
  }
  return out;
}

export async function loadTournamentSchedule(
  filePath = path.join(process.cwd(), "data", "tournament-schedule.json")
): Promise<TournamentSchedule> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as TournamentSchedule;
}

function sumMatchTeamXg(match: EgMatch, teamId: string): number {
  let xg = 0;
  for (const event of match.event ?? []) {
    if (event.contestantId !== teamId) continue;
    const q = (event.qualifier ?? []).find(
      (item) => Number(item.qualifierId) === XG_QUALIFIER_ID
    );
    if (!q) continue;
    const value = Number(q.value);
    if (Number.isFinite(value)) xg += value;
  }
  return xg;
}

function emptyVenueBucket() {
  return { xG: 0, xGC: 0, games: 0 };
}

function per90(total: number, games: number, fallback: number): number {
  if (games > 0) return total / games;
  return fallback;
}

function venueFromBucket(
  bucket: { xG: number; xGC: number; games: number },
  season: VenueMetrics
): VenueMetrics {
  if (bucket.games < MIN_VENUE_GAMES) {
    return { xGPer90: season.xGPer90, xGCPer90: season.xGCPer90 };
  }
  return {
    xGPer90: per90(bucket.xG, bucket.games, season.xGPer90),
    xGCPer90: per90(bucket.xGC, bucket.games, season.xGCPer90),
  };
}

/**
 * Build season + home/away xG/xGC per 90.
 * Venue xGC comes from the opponent's match xG in the paired EG feed (same match id).
 */
export function buildTeamMetrics(
  snapshots: CumulativeSnapshot[]
): Map<string, TeamMetrics> {
  const latest = new Map<string, CumulativeSnapshot>();
  for (const snapshot of snapshots) {
    const prev = latest.get(snapshot.teamId);
    if (!prev || snapshot.throughGameweek >= prev.throughGameweek) {
      latest.set(snapshot.teamId, snapshot);
    }
  }

  const matchTeamXg = new Map<string, Map<string, number>>();
  const teamMatchMeta = new Map<
    string,
    Array<{ matchId: string; location: "home" | "away"; oppositionId: string }>
  >();

  for (const [teamId, snapshot] of latest) {
    const raw = snapshot.expectedGoalsRaw as { match?: EgMatch[] } | undefined;
    for (const match of raw?.match ?? []) {
      if (!match.id) continue;
      const location =
        match.location === "home" || match.location === "away"
          ? match.location
          : null;
      if (!location) continue;

      const xg = sumMatchTeamXg(match, teamId);
      let byTeam = matchTeamXg.get(match.id);
      if (!byTeam) {
        byTeam = new Map();
        matchTeamXg.set(match.id, byTeam);
      }
      byTeam.set(teamId, xg);

      const list = teamMatchMeta.get(teamId) ?? [];
      list.push({
        matchId: match.id,
        location,
        oppositionId: match.oppositionContestantId ?? "",
      });
      teamMatchMeta.set(teamId, list);
    }
  }

  const metrics = new Map<string, TeamMetrics>();
  for (const [teamId, snapshot] of latest) {
    const gamesPlayed = Number(snapshot.teamStats.gamesPlayed ?? 0);
    if (!Number.isFinite(gamesPlayed) || gamesPlayed <= 0) continue;
    const xG = Number(snapshot.teamStats.xG ?? 0);
    const xGC = Number(snapshot.teamStats.xGC ?? 0);
    const season: VenueMetrics = {
      xGPer90: xG / gamesPlayed,
      xGCPer90: xGC / gamesPlayed,
    };

    const home = emptyVenueBucket();
    const away = emptyVenueBucket();

    for (const meta of teamMatchMeta.get(teamId) ?? []) {
      const byTeam = matchTeamXg.get(meta.matchId);
      if (!byTeam) continue;
      const teamXg = byTeam.get(teamId);
      if (teamXg == null) continue;

      let oppXg: number | undefined;
      if (meta.oppositionId && byTeam.has(meta.oppositionId)) {
        oppXg = byTeam.get(meta.oppositionId);
      } else {
        for (const [otherId, otherXg] of byTeam) {
          if (otherId !== teamId) {
            oppXg = otherXg;
            break;
          }
        }
      }
      if (oppXg == null) continue;

      const bucket = meta.location === "home" ? home : away;
      bucket.xG += teamXg;
      bucket.xGC += oppXg;
      bucket.games += 1;
    }

    metrics.set(teamId, {
      ...season,
      home: venueFromBucket(home, season),
      away: venueFromBucket(away, season),
    });
  }

  return metrics;
}

/** Percentile rank → continuous FDR in [1, 5] (higher value → harder). */
export function continuousRankToFdr(value: number, sortedAsc: number[]): number {
  if (!sortedAsc.length) return 3;
  let below = 0;
  let equal = 0;
  for (const v of sortedAsc) {
    if (v < value) below += 1;
    else if (v === value) equal += 1;
  }
  const pct = (below + 0.5 * equal) / sortedAsc.length;
  return 1 + pct * 4;
}

export function buildLeagueScales(metrics: Map<string, TeamMetrics>): LeagueScales {
  const seasonXg: number[] = [];
  const seasonNegXgc: number[] = [];
  for (const m of metrics.values()) {
    seasonXg.push(m.xGPer90);
    seasonNegXgc.push(-m.xGCPer90);
  }
  const asc = (a: number, b: number) => a - b;
  return {
    seasonXg: [...seasonXg].sort(asc),
    seasonNegXgc: [...seasonNegXgc].sort(asc),
  };
}

/**
 * Opponent-only difficulty (same for every team facing this opponent).
 * Base from season xG/xGC league ranks; ±0.9 venue (home easier / away harder).
 * Off ← opp defence (low xGC = hard); Def ← opp attack (high xG = hard).
 */
export function rateFixtureRaw(
  opponentId: string,
  isHome: boolean,
  metrics: Map<string, TeamMetrics>,
  scales: LeagueScales
): FixtureRawRating {
  const opp = metrics.get(opponentId);
  if (!opp) {
    return { fdrOffRaw: 3, fdrDefRaw: 3, fdrOverallRaw: 3 };
  }

  const venue = isHome ? -VENUE_DELTA : VENUE_DELTA;

  // Season ranks = Crellin-style team strength; venue is a separate band shift.
  const offBase = continuousRankToFdr(-opp.xGCPer90, scales.seasonNegXgc);
  const defBase = continuousRankToFdr(opp.xGPer90, scales.seasonXg);

  const fdrOffRaw = clampContinuous(offBase + venue);
  const fdrDefRaw = clampContinuous(defBase + venue);
  const fdrOverallRaw = clampContinuous((fdrOffRaw + fdrDefRaw) / 2);

  return { fdrOffRaw, fdrDefRaw, fdrOverallRaw };
}

export function rateFixture(
  opponentId: string,
  isHome: boolean,
  metrics: Map<string, TeamMetrics>,
  scales: LeagueScales
): FixtureRating {
  const raw = rateFixtureRaw(opponentId, isHome, metrics, scales);
  return {
    ...raw,
    fdrOff: clampRound(raw.fdrOffRaw),
    fdrDef: clampRound(raw.fdrDefRaw),
    fdrOverall: clampRound(raw.fdrOverallRaw),
  };
}

/** Build matchId → event (1-based chronological index) per team. */
function buildTeamEventMaps(
  matches: ScheduleMatch[],
  teamIds: Set<string>
): Map<string, Map<string, number>> {
  const byTeam = new Map<string, Map<string, number>>();
  for (const teamId of teamIds) {
    let event = 0;
    const events = new Map<string, number>();
    for (const match of matches) {
      if (match.homeContestantId !== teamId && match.awayContestantId !== teamId) {
        continue;
      }
      event += 1;
      events.set(match.id, event);
    }
    byTeam.set(teamId, events);
  }
  return byTeam;
}

export function computeNextFixtures(
  snapshots: CumulativeSnapshot[],
  schedule: TournamentSchedule,
  limit = 3
): Map<string, NextFixture[]> {
  const metrics = buildTeamMetrics(snapshots);
  const scales = buildLeagueScales(metrics);
  const cutoff = getStoreCutoffMs(snapshots, schedule);
  const matches = flattenScheduleMatches(schedule).sort(
    (a, b) => matchKickoffMs(a) - matchKickoffMs(b)
  );

  const teamIds = new Set<string>();
  for (const snapshot of snapshots) teamIds.add(snapshot.teamId);
  for (const match of matches) {
    teamIds.add(match.homeContestantId);
    teamIds.add(match.awayContestantId);
  }

  const eventMaps = buildTeamEventMaps(matches, teamIds);
  const result = new Map<string, NextFixture[]>();

  for (const teamId of teamIds) {
    const upcoming: NextFixture[] = [];
    const teamEvents = eventMaps.get(teamId) ?? new Map<string, number>();

    for (const match of matches) {
      if (upcoming.length >= limit) break;
      const kickoff = matchKickoffMs(match);
      if (!Number.isFinite(kickoff) || kickoff <= cutoff) continue;

      const isHome = match.homeContestantId === teamId;
      const isAway = match.awayContestantId === teamId;
      if (!isHome && !isAway) continue;

      const opponentId = isHome ? match.awayContestantId : match.homeContestantId;
      const opponentShortName = isHome
        ? match.awayContestantOptaSymId || "UNK"
        : match.homeContestantOptaSymId || "UNK";
      const event = teamEvents.get(match.id) ?? upcoming.length + 1;
      const rated = rateFixture(opponentId, isHome, metrics, scales);

      upcoming.push({
        event,
        opponentShortName,
        isHome,
        ...rated,
      });
    }
    result.set(teamId, upcoming);
  }

  return result;
}
