export type Position = "GKP" | "DEF" | "MID" | "FWD";

export type StatMap = Record<string, number>;

export interface ParsedPlayer {
  id: string;
  firstName: string;
  lastName: string;
  matchName: string;
  knownName?: string;
  displayName: string;
  position: Position;
  shirtNumber?: string;
  stats: StatMap;
}

export interface ParsedTeam {
  id: string;
  name: string;
  shortName: string;
  stats: StatMap;
}

export interface ParsedSnapshotPayload {
  team: ParsedTeam;
  players: ParsedPlayer[];
  source: "seasonStats" | "expectedGoals" | "merged";
}

export interface CumulativeSnapshot {
  throughGameweek: number;
  teamId: string;
  teamName: string;
  shortName: string;
  seasonStatsRaw?: unknown;
  expectedGoalsRaw?: unknown;
  teamStats: StatMap;
  players: ParsedPlayer[];
  uploadedAt: string;
}

export interface DataStore {
  snapshots: CumulativeSnapshot[];
  seeded: boolean;
}

export type FdrScore = 1 | 2 | 3 | 4 | 5;

export interface NextFixture {
  event: number;
  opponentShortName: string;
  isHome: boolean;
  fdrOff: FdrScore;
  fdrDef: FdrScore;
  fdrOverall: FdrScore;
}

export type RegressionStatus =
  | "UNDERPERFORMING"
  | "OVERPERFORMING"
  | "ALIGNED";

export interface PlayerRow {
  id: string;
  name: string;
  teamId: string;
  team: string;
  teamShort: string;
  position: Position;
  apps: number;
  mins: number;
  shots: number;
  shotsOnTarget: number;
  shotsInsideBox: number;
  bigChances: number;
  xG: number;
  goals: number;
  xGI: number;
  npxGI: number;
  gi: number;
  /** Goals + assists (same as gi); used for xGI variance tooltips. */
  actualReturns: number;
  /** actualReturns − xGI, rounded to 2 dp. */
  xGiVariance: number;
  regressionStatus: RegressionStatus;
  keyPasses: number;
  bigChancesCreated: number;
  xA: number;
  assists: number;
  corners: number;
  freeKicksTaken: number;
  freeKickGoals: number;
  penaltyGoals: number;
  clearances: number;
  blocks: number;
  interceptions: number;
  tackles: number;
  recoveries: number;
  cleanSheets: number;
  saves: number | null;
  dcPerGame: number | null;
  nextFixtures?: NextFixture[];
}

export interface TeamRow {
  id: string;
  name: string;
  shortName: string;
  xG: number;
  goals: number;
  deltaG: number; // G - xG
  xGC: number;
  goalsConceded: number;
  deltaGC: number; // xGC - GC
  xCS: number;
  cleanSheets: number;
  deltaCS: number; // CS - xCS
  gamesPlayed: number;
  nextFixtures?: NextFixture[];
}

export interface MetaResponse {
  maxGameweek: number;
  minGameweek: number;
  teams: { id: string; name: string; shortName: string }[];
  snapshotCount: number;
  seeded: boolean;
  /** True when ingest/clear/seed require ADMIN_SECRET */
  writeProtected: boolean;
  /** Where snapshots are persisted (`blob` required on Vercel). */
  storageMode: "blob" | "filesystem";
}

export type FdrPerspective = "offensive" | "defensive";

export interface TrackerFixtureCell {
  opponentCode: string;
  isHome: boolean;
  fdrOff: FdrScore;
  fdrDef: FdrScore;
}

export interface FixtureTrackerTeamRow {
  teamId: string;
  teamCode: string;
  teamName: string;
  /** GW → fixtures (empty = BGW; length ≥ 2 = DGW). */
  byGw: Record<number, TrackerFixtureCell[]>;
}

export interface FixtureTrackerResponse {
  latestUploadedGw: number;
  startGw: number;
  endGw: number;
  teams: FixtureTrackerTeamRow[];
}

export interface StatsResponse {
  players: PlayerRow[];
  teams: TeamRow[];
  meta: {
    fromGw: number;
    toGw: number;
    baselineNote?: string;
  };
}
