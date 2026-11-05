import type { PlayerRow, Position } from "@/lib/types";
import { formatNum, round } from "@/lib/utils";

export type StatMode = "per90" | "total";

export type MatrixWinner = "a" | "b" | "tie" | "na";

export type MatrixMetricDef = {
  key: string;
  label: string;
  /** Lower value wins (e.g. FDR). Default higher-better. */
  lowerIsBetter?: boolean;
  digits?: number;
  format?: "number" | "percent";
  get: (player: PlayerRow, mode: StatMode) => number | null;
};

export type MatrixCategory = {
  id: string;
  title: string;
  metrics: MatrixMetricDef[];
};

const MIN_PEER_MINS = 180;

export function per90(value: number, mins: number): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(mins) || mins <= 0) return null;
  return round((value * 90) / mins, 2);
}

export function scaleValue(value: number, mins: number, mode: StatMode): number | null {
  if (mode === "total") return Number.isFinite(value) ? value : null;
  return per90(value, mins);
}

/** Approximate npxG from stored npxGI − xA. */
export function approxNpxG(player: PlayerRow): number {
  return round(Math.max(0, player.npxGI - player.xA), 2);
}

export function shotConversion(player: PlayerRow): number | null {
  if (!player.shots || player.shots <= 0) return null;
  return round((player.goals / player.shots) * 100, 1);
}

export function avgNextFdr(
  player: PlayerRow,
  mode: "overall" | "off" | "def" = "overall"
): number | null {
  const fixtures = player.nextFixtures ?? [];
  if (!fixtures.length) return null;
  const sum = fixtures.reduce((acc, f) => {
    if (mode === "off") return acc + f.fdrOff;
    if (mode === "def") return acc + f.fdrDef;
    return acc + f.fdrOverall;
  }, 0);
  return round(sum / fixtures.length, 2);
}

export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0]![0]}. ${parts.slice(1).join(" ")}`;
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 3).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export function findDefaultPair(players: PlayerRow[]): [PlayerRow | null, PlayerRow | null] {
  const outfield = players.filter((p) => p.position !== "GKP");
  const byHint = (hint: string) =>
    outfield.find((p) => p.name.toLowerCase().includes(hint.toLowerCase())) ?? null;

  const a = byHint("Gibbs-White") ?? byHint("Gibbs");
  const b = byHint("Wharton");
  if (a && b && a.id !== b.id) return [a, b];

  const mids = outfield
    .filter((p) => p.position === "MID" && p.mins >= MIN_PEER_MINS)
    .sort((x, y) => y.xGI - x.xGI);
  if (mids.length >= 2) return [mids[0]!, mids[1]!];

  const sorted = [...outfield].sort((x, y) => y.mins - x.mins);
  if (sorted.length >= 2) return [sorted[0]!, sorted[1]!];
  if (sorted.length === 1) return [sorted[0]!, null];
  return [null, null];
}

export function positionLabel(position: Position): string {
  if (position === "GKP") return "Goalkeepers";
  if (position === "DEF") return "Defenders";
  if (position === "MID") return "Midfielders";
  return "Forwards";
}

/** Rank percentile 0–100 among peers (higher value = higher percentile). */
export function percentileAmong(
  value: number,
  peerValues: number[]
): number {
  if (!peerValues.length) return 50;
  const sorted = [...peerValues].sort((a, b) => a - b);
  let below = 0;
  for (const v of sorted) {
    if (v < value) below += 1;
    else break;
  }
  if (sorted.length === 1) return 100;
  return round((below / (sorted.length - 1)) * 100, 0);
}

export type RadarAxisKey =
  | "mins"
  | "apps"
  | "xg"
  | "bccKp"
  | "xgi"
  | "dcg"
  | "setPieces";

export type RadarAxisDef = {
  key: RadarAxisKey;
  label: string;
  /** Display precision: 0 = whole numbers; 1–2 for rates. */
  digits: number;
  get: (p: PlayerRow, mode: StatMode) => number | null;
};

export type RadarAxisSet = "defensive" | "attacking";

function minsPerApp(p: PlayerRow): number {
  if (!p.apps || p.apps <= 0) return 0;
  return round(p.mins / p.apps, 2);
}

function setPiecesTotal(p: PlayerRow): number {
  return (p.corners ?? 0) + (p.freeKicksTaken ?? 0) + (p.penaltyGoals ?? 0);
}

function bccKpTotal(p: PlayerRow): number {
  return (p.bigChancesCreated ?? 0) + (p.keyPasses ?? 0);
}

/** Shared middle/end axes for both radar sets (order varies per set). */
const AXIS_MINS: RadarAxisDef = {
  key: "mins",
  label: "Mins",
  digits: 0,
  get: (p) => (Number.isFinite(p.mins) ? p.mins : null),
};

const AXIS_APPS: RadarAxisDef = {
  key: "apps",
  label: "Apps",
  digits: 0,
  get: (p) => (Number.isFinite(p.apps) ? p.apps : null),
};

const AXIS_XG: RadarAxisDef = {
  key: "xg",
  label: "xG",
  digits: 2,
  get: (p, mode) => scaleValue(p.xG, p.mins, mode),
};

const AXIS_BCC_KP: RadarAxisDef = {
  key: "bccKp",
  label: "KP + BCC",
  digits: 0,
  get: (p, mode) => scaleValue(bccKpTotal(p), p.mins, mode),
};

const AXIS_XGI: RadarAxisDef = {
  key: "xgi",
  label: "xGI",
  digits: 2,
  get: (p, mode) => scaleValue(p.xGI, p.mins, mode),
};

const AXIS_DCG: RadarAxisDef = {
  key: "dcg",
  label: "DC/G",
  digits: 2,
  get: (p) => p.dcPerGame,
};

const AXIS_SET_PIECES: RadarAxisDef = {
  key: "setPieces",
  label: "Set Pieces",
  digits: 0,
  get: (p, mode) => scaleValue(setPiecesTotal(p), p.mins, mode),
};

/** Either player is DEF: Mins, xG, KP+BCC, xGI, DC/G, Set Pieces. */
const DEFENSIVE_RADAR_AXES: RadarAxisDef[] = [
  AXIS_MINS,
  AXIS_XG,
  AXIS_BCC_KP,
  AXIS_XGI,
  AXIS_DCG,
  AXIS_SET_PIECES,
];

/** MID/FWD only: Apps, Mins, xG, KP+BCC, xGI, Set Pieces. */
const ATTACKING_RADAR_AXES: RadarAxisDef[] = [
  AXIS_APPS,
  AXIS_MINS,
  AXIS_XG,
  AXIS_BCC_KP,
  AXIS_XGI,
  AXIS_SET_PIECES,
];

/** Defensive set when either player is DEF; otherwise attacking (MID/FWD only). */
export function radarAxisSetForPair(a: Position, b: Position): RadarAxisSet {
  if (a === "DEF" || b === "DEF") return "defensive";
  return "attacking";
}

export function radarAxesForPair(a: Position, b: Position): RadarAxisDef[] {
  return radarAxisSetForPair(a, b) === "defensive"
    ? DEFENSIVE_RADAR_AXES
    : ATTACKING_RADAR_AXES;
}

export function peerPool(players: PlayerRow[], position: Position): PlayerRow[] {
  return players.filter((p) => p.position === position && p.mins >= MIN_PEER_MINS);
}

/** Peer pool = union of both positions (outfield), mins ≥ 180. */
export function peerPoolForPair(
  players: PlayerRow[],
  positionA: Position,
  positionB: Position
): PlayerRow[] {
  const positions = new Set<Position>(
    [positionA, positionB].filter((pos) => pos !== "GKP")
  );
  return players.filter((p) => positions.has(p.position) && p.mins >= MIN_PEER_MINS);
}

export function formatRadarValue(
  value: number | null,
  digits: number
): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return formatNum(value, digits);
}

export function formatRadarAxisPair(
  axis: RadarAxisDef,
  playerA: PlayerRow,
  playerB: PlayerRow,
  mode: StatMode
): string {
  const a = formatRadarValue(axis.get(playerA, mode), axis.digits);
  const b = formatRadarValue(axis.get(playerB, mode), axis.digits);
  return `${axis.label} (${a} vs ${b})`;
}

export function radarPercentiles(
  player: PlayerRow,
  peers: PlayerRow[],
  axes: RadarAxisDef[],
  mode: StatMode
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const axis of axes) {
    const value = axis.get(player, mode);
    const peerVals = peers
      .map((p) => axis.get(p, mode))
      .filter((v): v is number => v !== null && Number.isFinite(v));
    result[axis.key] =
      value === null ? 0 : percentileAmong(value, peerVals.length ? peerVals : [value]);
  }
  return result;
}

export const MATRIX_CATEGORIES: MatrixCategory[] = [
  {
    id: "general",
    title: "1. General",
    metrics: [
      {
        key: "apps",
        label: "Appearances",
        digits: 0,
        get: (p) => (Number.isFinite(p.apps) ? p.apps : null),
      },
      {
        key: "mins",
        label: "Minutes",
        digits: 0,
        get: (p) => (Number.isFinite(p.mins) ? p.mins : null),
      },
      {
        key: "minsApp",
        label: "Avg Minutes / Game",
        digits: 1,
        get: (p) => {
          const v = minsPerApp(p);
          return v > 0 ? v : null;
        },
      },
    ],
  },
  {
    id: "attack",
    title: "2. Attacking",
    metrics: [
      {
        key: "shots",
        label: "Shots",
        digits: 2,
        get: (p, mode) => scaleValue(p.shots, p.mins, mode),
      },
      {
        key: "xG",
        label: "xG",
        get: (p, mode) => scaleValue(p.xG, p.mins, mode),
      },
      {
        key: "kp",
        label: "KP",
        get: (p, mode) => scaleValue(p.keyPasses, p.mins, mode),
      },
      {
        key: "bcc",
        label: "BCC",
        get: (p, mode) => scaleValue(p.bigChancesCreated, p.mins, mode),
      },
      {
        key: "kpBcc",
        label: "KP + BCC",
        digits: 0,
        get: (p, mode) => scaleValue(bccKpTotal(p), p.mins, mode),
      },
      {
        key: "xA",
        label: "xA",
        get: (p, mode) => scaleValue(p.xA, p.mins, mode),
      },
      {
        key: "xGI",
        label: "xGI",
        get: (p, mode) => scaleValue(p.xGI, p.mins, mode),
      },
    ],
  },
  {
    id: "defense",
    title: "3. Defensive",
    metrics: [
      {
        key: "dcg",
        label: "DC/G",
        digits: 2,
        get: (p) => p.dcPerGame,
      },
    ],
  },
  {
    id: "setPieces",
    title: "4. Set Pieces",
    metrics: [
      {
        key: "corners",
        label: "Corners",
        digits: 0,
        get: (p, mode) => scaleValue(p.corners ?? 0, p.mins, mode),
      },
      {
        key: "fkTaken",
        label: "FK Taken",
        digits: 0,
        get: (p, mode) => scaleValue(p.freeKicksTaken ?? 0, p.mins, mode),
      },
      {
        key: "pens",
        label: "Pens",
        digits: 0,
        get: (p, mode) => scaleValue(p.penaltyGoals ?? 0, p.mins, mode),
      },
    ],
  },
];

export function compareMetric(
  a: number | null,
  b: number | null,
  lowerIsBetter?: boolean
): MatrixWinner {
  if (a === null && b === null) return "na";
  if (a === null) return "b";
  if (b === null) return "a";
  if (Math.abs(a - b) < 1e-9) return "tie";
  if (lowerIsBetter) return a < b ? "a" : "b";
  return a > b ? "a" : "b";
}

export function formatMetricValue(
  value: number | null,
  def: MatrixMetricDef
): string {
  if (value === null) return "—";
  if (def.format === "percent") return `${formatNum(value, def.digits ?? 1)}%`;
  return formatNum(value, def.digits ?? 2);
}

export type ArchetypeAnalysis = {
  title: string;
  body: string;
  goalThreatTiltA: number;
  chanceTiltA: number;
  xg90A: number | null;
  xg90B: number | null;
  bcc90A: number | null;
  bcc90B: number | null;
  recommendation: string;
  indexDelta: number;
};

function tiltShare(a: number, b: number): number {
  const total = a + b;
  if (total <= 0) return 50;
  return round((a / total) * 100, 0);
}

export function buildArchetype(
  playerA: PlayerRow,
  playerB: PlayerRow
): ArchetypeAnalysis {
  const shortA = initialsFromName(playerA.name);
  const shortB = initialsFromName(playerB.name);
  const xg90A = per90(playerA.xG, playerA.mins) ?? 0;
  const xg90B = per90(playerB.xG, playerB.mins) ?? 0;
  const bcc90A = per90(playerA.bigChancesCreated, playerA.mins) ?? 0;
  const bcc90B = per90(playerB.bigChancesCreated, playerB.mins) ?? 0;
  const xgi90A = per90(playerA.xGI, playerA.mins) ?? 0;
  const xgi90B = per90(playerB.xGI, playerB.mins) ?? 0;

  const goalThreatTiltA = tiltShare(xg90A, xg90B);
  const chanceTiltA = tiltShare(bcc90A, bcc90B);

  const aFinisher = xg90A >= xg90B;
  const aCreator = bcc90A >= bcc90B;
  const labelA = aFinisher ? "Direct Finisher" : aCreator ? "Volume Creator" : "Balanced Profile";
  const labelB = !aFinisher && xg90B > xg90A
    ? "Direct Finisher"
    : bcc90B > bcc90A
      ? "Deep Volume Creator"
      : "Balanced Profile";

  const xgDelta = round(Math.abs(xg90A - xg90B), 2);
  const leaderXg = xg90A >= xg90B ? shortA : shortB;
  const creator = bcc90A >= bcc90B ? shortA : shortB;
  const bccLift =
    Math.min(bcc90A, bcc90B) > 0
      ? round((Math.max(bcc90A, bcc90B) / Math.min(bcc90A, bcc90B) - 1) * 100, 0)
      : null;

  const body = `${shortName(playerA.name)} profiles as a ${labelA.toLowerCase()} while ${shortName(playerB.name)} leans ${labelB.toLowerCase()}. ${leaderXg} holds a ${xgDelta} xG/90 edge; ${creator} leads chance creation${bccLift !== null ? ` (+${bccLift}% BCC/90)` : ""}.`;

  const preferA = xgi90A >= xgi90B;
  const recommendation = preferA
    ? `Hold / Target ${shortName(playerA.name)} on current involvement edge.`
    : `Hold / Target ${shortName(playerB.name)} on current involvement edge.`;

  return {
    title: `${labelA} (${shortA}) vs ${labelB} (${shortB})`,
    body,
    goalThreatTiltA,
    chanceTiltA,
    xg90A: per90(playerA.xG, playerA.mins),
    xg90B: per90(playerB.xG, playerB.mins),
    bcc90A: per90(playerA.bigChancesCreated, playerA.mins),
    bcc90B: per90(playerB.bigChancesCreated, playerB.mins),
    recommendation,
    indexDelta: round(Math.abs(xgi90A - xgi90B) * 10, 1),
  };
}
