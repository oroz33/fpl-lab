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

export type TeamMetrics = { xGPer90: number; xGCPer90: number };

const VENUE_DELTA = 0.35;

/** Off FDR anchors: lower opp xGC → harder to attack (higher FDR). */
const OFF_ANCHORS: { x: number; y: number }[] = [
  { x: 0.9, y: 5 },
  { x: 1.2, y: 4 },
  { x: 1.5, y: 3 },
  { x: 1.8, y: 1 },
];

/** Def FDR anchors: higher opp xG → harder to defend (higher FDR). */
const DEF_ANCHORS: { x: number; y: number }[] = [
  { x: 0.9, y: 1 },
  { x: 1.2, y: 2 },
  { x: 1.5, y: 3 },
  { x: 1.8, y: 5 },
];

export function clampRound(value: number): FdrScore {
  return Math.min(5, Math.max(1, Math.round(value))) as FdrScore;
}

function interpolateAnchors(x: number, anchors: { x: number; y: number }[]): number {
  if (x <= anchors[0]!.x) return anchors[0]!.y;
  const last = anchors[anchors.length - 1]!;
  if (x >= last.x) return last.y;
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i]!;
    const b = anchors[i + 1]!;
    if (x >= a.x && x <= b.x) {
      const t = (x - a.x) / (b.x - a.x);
      return a.y + t * (b.y - a.y);
    }
  }
  return 3;
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

  const metrics = new Map<string, TeamMetrics>();
  for (const [teamId, snapshot] of latest) {
    const gamesPlayed = Number(snapshot.teamStats.gamesPlayed ?? 0);
    if (!Number.isFinite(gamesPlayed) || gamesPlayed <= 0) continue;
    const xG = Number(snapshot.teamStats.xG ?? 0);
    const xGC = Number(snapshot.teamStats.xGC ?? 0);
    metrics.set(teamId, {
      xGPer90: xG / gamesPlayed,
      xGCPer90: xGC / gamesPlayed,
    });
  }
  return metrics;
}

/** Continuous Off FDR from opponent xGC per 90 (higher xGC = easier to attack). */
export function rateOffContinuous(xGCPer90: number): number {
  return interpolateAnchors(xGCPer90, OFF_ANCHORS);
}

/** Continuous Def FDR from opponent xG per 90 (higher xG = harder to defend). */
export function rateDefContinuous(xGPer90: number): number {
  return interpolateAnchors(xGPer90, DEF_ANCHORS);
}

function venueDelta(isHome: boolean): number {
  return isHome ? -VENUE_DELTA : VENUE_DELTA;
}

/** Rate a fixture vs opponent metrics (shared by Next fixtures + tracker matrix). */
export function rateFixture(
  opponentId: string,
  isHome: boolean,
  metrics: Map<string, TeamMetrics>
): { fdrOff: FdrScore; fdrDef: FdrScore; fdrOverall: FdrScore } {
  const opp = metrics.get(opponentId);
  if (!opp) {
    return { fdrOff: 3, fdrDef: 3, fdrOverall: 3 };
  }

  const delta = venueDelta(isHome);
  const fdrOffRaw = rateOffContinuous(opp.xGCPer90) + delta;
  const fdrDefRaw = rateDefContinuous(opp.xGPer90) + delta;

  return {
    fdrOff: clampRound(fdrOffRaw),
    fdrDef: clampRound(fdrDefRaw),
    fdrOverall: clampRound((fdrOffRaw + fdrDefRaw) / 2),
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

function toNextFixture(
  event: number,
  opponentId: string,
  opponentShortName: string,
  isHome: boolean,
  metrics: Map<string, TeamMetrics>
): NextFixture {
  const rated = rateFixture(opponentId, isHome, metrics);
  return {
    event,
    opponentShortName,
    isHome,
    ...rated,
  };
}

export function computeNextFixtures(
  snapshots: CumulativeSnapshot[],
  schedule: TournamentSchedule,
  limit = 3
): Map<string, NextFixture[]> {
  const metrics = buildTeamMetrics(snapshots);
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

      upcoming.push(
        toNextFixture(event, opponentId, opponentShortName, isHome, metrics)
      );
    }
    result.set(teamId, upcoming);
  }

  return result;
}
