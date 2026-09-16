import type { ParsedPlayer, Position, StatMap } from "@/lib/types";
import { round } from "@/lib/utils";

function get(stats: StatMap, ...keys: string[]): number {
  for (const key of keys) {
    if (stats[key] !== undefined && stats[key] !== null) return stats[key];
  }
  return 0;
}

export function mergePlayerStats(
  season?: ParsedPlayer,
  expected?: ParsedPlayer
): ParsedPlayer {
  const base = season ?? expected!;
  const other = season && expected ? expected : undefined;
  const stats: StatMap = { ...(season?.stats ?? {}) };

  if (other) {
    for (const [k, v] of Object.entries(other.stats)) {
      stats[k] = v;
    }
  } else if (expected && !season) {
    Object.assign(stats, expected.stats);
  }

  return {
    id: base.id,
    firstName: base.firstName || expected?.firstName || "",
    lastName: base.lastName || expected?.lastName || "",
    matchName: base.matchName || expected?.matchName || "",
    knownName: base.knownName || expected?.knownName,
    displayName: base.displayName || expected?.displayName || "Unknown",
    position: base.position || expected?.position || "MID",
    shirtNumber: base.shirtNumber || expected?.shirtNumber,
    stats,
  };
}

export function mergeTeamStats(season: StatMap, expected: StatMap): StatMap {
  return { ...season, ...expected };
}

/** Normalize merged Opta maps into canonical internal keys used by the delta engine. */
export function toCanonicalPlayerStats(player: ParsedPlayer): StatMap {
  const s = player.stats;
  const apps = get(s, "Appearances", "Games Played");
  const mins = get(s, "Time Played", "minsPlayed");
  const shots = get(s, "totalScoringAtt", "Total Shots");
  const shotsOnTarget = get(s, "ontargetScoringAtt", "Shots On Target ( inc goals )");
  const shotsInsideBox =
    get(s, "attIboxGoal") +
    get(s, "attIboxMiss") +
    get(s, "attIboxTarget") +
    get(s, "attIboxBlocked") +
    get(s, "attIboxPost") +
    get(s, "attIboxOwnGoal");
  const bigChancesScored = get(s, "bigChanceScored", "Total Big Chances Scored");
  const bigChancesMissed = get(s, "bigChanceMissed", "Total Big Chances Missed");
  const bigChances = bigChancesScored + bigChancesMissed;
  const xG = get(s, "expectedGoals");
  const npxG = get(s, "expectedGoalsNonpenalty", "expectedGoals");
  const goals = get(s, "goals", "Goals");
  const xA = get(s, "expectedAssists");
  const assists = get(s, "goalAssist", "Goal Assists", "Assists (Intentional)");
  const keyPasses = get(s, "totalAttAssist", "Key Passes (Attempt Assists)");
  const bigChancesCreated = get(s, "bigChanceCreated", "Total Big Chances Created");
  const corners = get(s, "Corners Taken (incl short corners)");
  const freeKicksTaken = get(
    s,
    "Free Kicks Taken",
    "Direct Free Kick Taken",
    "Attempts from Set Pieces"
  );
  const freeKickGoals = get(s, "Free Kick Goals", "Goals from Direct Free Kick");
  const penaltyGoals = get(s, "Penalty Goals", "attPenGoal");
  const clearances = get(s, "Total Clearances");
  const blocks = get(s, "Blocks");
  const interceptions = get(s, "Interceptions");
  const tackles = get(s, "Total Tackles");
  const recoveries = get(s, "Recoveries");
  const cleanSheets = get(s, "Clean Sheets");
  const saves = get(s, "Saves Made");

  return {
    apps,
    mins,
    shots,
    shotsOnTarget,
    shotsInsideBox,
    bigChances,
    xG,
    npxG,
    goals,
    xA,
    assists,
    keyPasses,
    bigChancesCreated,
    corners,
    freeKicksTaken,
    freeKickGoals,
    penaltyGoals,
    clearances,
    blocks,
    interceptions,
    tackles,
    recoveries,
    cleanSheets,
    saves,
  };
}

export function toCanonicalTeamStats(stats: StatMap): StatMap {
  return {
    gamesPlayed: get(stats, "Games Played"),
    goals: get(stats, "goals", "Goals"),
    xG: get(stats, "expectedGoals"),
    goalsConceded: get(stats, "Goals Conceded"),
    xGC: get(stats, "expectedGoalsConceded"),
    cleanSheets: get(stats, "Clean Sheets"),
  };
}

export function computeDcPerGame(
  position: Position,
  clearances: number,
  blocks: number,
  interceptions: number,
  tackles: number,
  recoveries: number,
  apps: number
): number | null {
  if (position === "GKP") return null;
  if (!apps) return null;
  const base = clearances + blocks + interceptions + tackles;
  const total = position === "DEF" ? base : base + recoveries;
  return round(total / apps, 2);
}

export function computeXcs(xGC: number, gamesPlayed: number): number {
  if (!gamesPlayed || gamesPlayed <= 0) return 0;
  const perGame = xGC / gamesPlayed;
  return round(gamesPlayed * Math.exp(-perGame), 2);
}
