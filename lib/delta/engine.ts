import type {
  CumulativeSnapshot,
  PlayerRow,
  StatMap,
  TeamRow,
} from "@/lib/types";
import { computeDcPerGame, computeXcs } from "@/lib/mapping/playerStats";
import { round } from "@/lib/utils";

const NUMERIC_KEYS = [
  "apps",
  "mins",
  "shots",
  "shotsOnTarget",
  "shotsInsideBox",
  "bigChances",
  "xG",
  "npxG",
  "goals",
  "xA",
  "assists",
  "keyPasses",
  "bigChancesCreated",
  "corners",
  "freeKicksTaken",
  "freeKickGoals",
  "penaltyGoals",
  "clearances",
  "blocks",
  "interceptions",
  "tackles",
  "recoveries",
  "cleanSheets",
  "saves",
] as const;

function emptyStats(): StatMap {
  const s: StatMap = {};
  for (const k of NUMERIC_KEYS) s[k] = 0;
  return s;
}

function subtractStats(curr: StatMap, prev: StatMap): StatMap {
  const out = emptyStats();
  for (const k of NUMERIC_KEYS) {
    out[k] = (curr[k] ?? 0) - (prev[k] ?? 0);
  }
  return out;
}

function addStats(a: StatMap, b: StatMap): StatMap {
  const out = emptyStats();
  for (const k of NUMERIC_KEYS) {
    out[k] = (a[k] ?? 0) + (b[k] ?? 0);
  }
  return out;
}

interface WeekDelta {
  /** Inclusive start of the week block this delta represents */
  gwStart: number;
  /** Inclusive end */
  gwEnd: number;
  teamId: string;
  teamName: string;
  shortName: string;
  teamStats: StatMap;
  players: Map<string, { meta: CumulativeSnapshot["players"][number]; stats: StatMap }>;
}

/**
 * Build per-period deltas for a team from cumulative snapshots.
 * Baseline through GW3 becomes a single inseparable block [1,3].
 * Later weeks: delta(n) = cum(n) - cum(n-1) for single week n.
 */
export function buildTeamDeltas(snapshots: CumulativeSnapshot[]): WeekDelta[] {
  if (snapshots.length === 0) return [];

  const sorted = [...snapshots].sort((a, b) => a.throughGameweek - b.throughGameweek);
  const deltas: WeekDelta[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i];
    const prev = i > 0 ? sorted[i - 1] : null;

    let gwStart: number;
    let gwEnd: number;
    let teamStats: StatMap;
    const players = new Map<
      string,
      { meta: CumulativeSnapshot["players"][number]; stats: StatMap }
    >();

    if (!prev) {
      // Baseline block: attribute entire cumulative to GW1..throughGameweek
      gwStart = 1;
      gwEnd = curr.throughGameweek;
      teamStats = { ...emptyTeam(), ...curr.teamStats };
      for (const p of curr.players) {
        players.set(p.id, { meta: p, stats: { ...emptyStats(), ...p.stats } });
      }
    } else {
      gwStart = prev.throughGameweek + 1;
      gwEnd = curr.throughGameweek;
      teamStats = subtractTeam(curr.teamStats, prev.teamStats);

      const prevMap = new Map(prev.players.map((p) => [p.id, p]));
      const ids = new Set([
        ...curr.players.map((p) => p.id),
        ...prev.players.map((p) => p.id),
      ]);

      for (const id of ids) {
        const c = curr.players.find((p) => p.id === id);
        const p = prevMap.get(id);
        const meta = c ?? p!;
        const stats = subtractStats(
          { ...emptyStats(), ...(c?.stats ?? {}) },
          { ...emptyStats(), ...(p?.stats ?? {}) }
        );
        players.set(id, { meta, stats });
      }
    }

    deltas.push({
      gwStart,
      gwEnd,
      teamId: curr.teamId,
      teamName: curr.teamName,
      shortName: curr.shortName,
      teamStats,
      players,
    });
  }

  return deltas;
}

function emptyTeam(): StatMap {
  return {
    gamesPlayed: 0,
    goals: 0,
    xG: 0,
    goalsConceded: 0,
    xGC: 0,
    cleanSheets: 0,
  };
}

function subtractTeam(curr: StatMap, prev: StatMap): StatMap {
  const keys = ["gamesPlayed", "goals", "xG", "goalsConceded", "xGC", "cleanSheets"];
  const out: StatMap = {};
  for (const k of keys) {
    out[k] = (curr[k] ?? 0) - (prev[k] ?? 0);
  }
  return out;
}

function addTeam(a: StatMap, b: StatMap): StatMap {
  const keys = ["gamesPlayed", "goals", "xG", "goalsConceded", "xGC", "cleanSheets"];
  const out: StatMap = {};
  for (const k of keys) {
    out[k] = (a[k] ?? 0) + (b[k] ?? 0);
  }
  return out;
}

function overlaps(delta: WeekDelta, fromGw: number, toGw: number): boolean {
  return delta.gwStart <= toGw && delta.gwEnd >= fromGw;
}

export function aggregateRange(
  allSnapshots: CumulativeSnapshot[],
  fromGw: number,
  toGw: number
): { players: PlayerRow[]; teams: TeamRow[]; baselineNote?: string } {
  const byTeam = new Map<string, CumulativeSnapshot[]>();
  for (const s of allSnapshots) {
    const list = byTeam.get(s.teamId) ?? [];
    list.push(s);
    byTeam.set(s.teamId, list);
  }

  const playerAcc = new Map<
    string,
    {
      meta: CumulativeSnapshot["players"][number];
      teamId: string;
      teamName: string;
      shortName: string;
      stats: StatMap;
    }
  >();
  const teamAcc = new Map<
    string,
    { teamId: string; teamName: string; shortName: string; stats: StatMap }
  >();

  let baselineNote: string | undefined;

  for (const [, snaps] of byTeam) {
    const deltas = buildTeamDeltas(snaps);
    for (const d of deltas) {
      if (!overlaps(d, fromGw, toGw)) continue;

      if (d.gwStart === 1 && d.gwEnd >= 3 && (fromGw <= 3 || toGw <= 3)) {
        baselineNote =
          "GW1–GW3 are an inseparable baseline block from the first cumulative upload.";
      }

      const existingTeam = teamAcc.get(d.teamId);
      if (existingTeam) {
        existingTeam.stats = addTeam(existingTeam.stats, d.teamStats);
      } else {
        teamAcc.set(d.teamId, {
          teamId: d.teamId,
          teamName: d.teamName,
          shortName: d.shortName,
          stats: { ...d.teamStats },
        });
      }

      for (const [pid, pdata] of d.players) {
        const key = `${d.teamId}:${pid}`;
        const existing = playerAcc.get(key);
        if (existing) {
          existing.stats = addStats(existing.stats, pdata.stats);
        } else {
          playerAcc.set(key, {
            meta: pdata.meta,
            teamId: d.teamId,
            teamName: d.teamName,
            shortName: d.shortName,
            stats: { ...pdata.stats },
          });
        }
      }
    }
  }

  const players: PlayerRow[] = [...playerAcc.values()]
    .map((p) => {
      const s = p.stats;
      const apps = s.apps ?? 0;
      const goals = Number(s.goals ?? s.g ?? 0);
      const assists = Number(s.assists ?? s.goalAssist ?? s.a ?? 0);
      const xG = Number(s.xG ?? s.expectedGoals ?? 0);
      const xA = Number(s.xA ?? s.expectedAssists ?? 0);
      const npxG = Number(s.npxG ?? xG);
      const actualReturns = goals + assists;
      const xGI = round(xG + xA, 2);
      const rawVar = actualReturns - xGI;
      const xGiVariance = Number.isNaN(rawVar) ? 0 : round(rawVar, 2);
      const regressionStatus =
        xGiVariance <= -0.75
          ? ("UNDERPERFORMING" as const)
          : xGiVariance >= 0.75
            ? ("OVERPERFORMING" as const)
            : ("ALIGNED" as const);
      const position = p.meta.position;
      const saves = position === "GKP" ? s.saves ?? 0 : null;
      const dcPerGame = computeDcPerGame(
        position,
        s.clearances ?? 0,
        s.blocks ?? 0,
        s.interceptions ?? 0,
        s.tackles ?? 0,
        s.recoveries ?? 0,
        apps
      );

      return {
        id: `${p.teamId}:${p.meta.id}`,
        name: p.meta.displayName,
        teamId: p.teamId,
        team: p.teamName,
        teamShort: p.shortName,
        position,
        apps,
        mins: s.mins ?? 0,
        shots: s.shots ?? 0,
        shotsOnTarget: s.shotsOnTarget ?? 0,
        shotsInsideBox: s.shotsInsideBox ?? 0,
        bigChances: s.bigChances ?? 0,
        xG: round(xG, 2),
        goals,
        xGI,
        npxGI: round(npxG + xA, 2),
        gi: actualReturns,
        actualReturns,
        xGiVariance,
        regressionStatus,
        keyPasses: s.keyPasses ?? 0,
        bigChancesCreated: s.bigChancesCreated ?? 0,
        xA: round(xA, 2),
        assists,
        corners: s.corners ?? 0,
        freeKicksTaken: s.freeKicksTaken ?? 0,
        freeKickGoals: s.freeKickGoals ?? 0,
        penaltyGoals: s.penaltyGoals ?? 0,
        clearances: s.clearances ?? 0,
        blocks: s.blocks ?? 0,
        interceptions: s.interceptions ?? 0,
        tackles: s.tackles ?? 0,
        recoveries: s.recoveries ?? 0,
        cleanSheets: s.cleanSheets ?? 0,
        saves,
        dcPerGame,
      };
    })
    .filter((p) => p.apps > 0 || p.mins > 0)
    .sort((a, b) => b.mins - a.mins);

  const teams: TeamRow[] = [...teamAcc.values()]
    .map((t) => {
      const s = t.stats;
      const gamesPlayed = s.gamesPlayed ?? 0;
      const xG = round(s.xG ?? 0, 2);
      const goals = s.goals ?? 0;
      const xGC = round(s.xGC ?? 0, 2);
      const goalsConceded = s.goalsConceded ?? 0;
      const xCS = computeXcs(xGC, gamesPlayed || 3);
      const cleanSheets = s.cleanSheets ?? 0;
      return {
        id: t.teamId,
        name: t.teamName,
        shortName: t.shortName,
        xG,
        goals,
        deltaG: round(goals - xG, 2),
        xGC,
        goalsConceded,
        deltaGC: round(xGC - goalsConceded, 2),
        xCS,
        cleanSheets,
        deltaCS: round(cleanSheets - xCS, 2),
        gamesPlayed: gamesPlayed || 3,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return { players, teams, baselineNote };
}

export function getMetaFromSnapshots(snapshots: CumulativeSnapshot[]) {
  if (snapshots.length === 0) {
    return { minGameweek: 1, maxGameweek: 3, teams: [] as { id: string; name: string; shortName: string }[] };
  }
  const maxGameweek = Math.max(...snapshots.map((s) => s.throughGameweek), 3);
  const teamMap = new Map<string, { id: string; name: string; shortName: string }>();
  for (const s of snapshots) {
    teamMap.set(s.teamId, { id: s.teamId, name: s.teamName, shortName: s.shortName });
  }
  return {
    minGameweek: 1,
    maxGameweek,
    teams: [...teamMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}
