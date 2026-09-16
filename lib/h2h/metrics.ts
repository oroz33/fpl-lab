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
  | "dcg"
  | "minsApp"
  | "xgi"
  | "bccKp"
  | "setPieces"
  | "cs"
  | "ga"
  | "shots";

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

const SHARED_RADAR_AXES: RadarAxisDef[] = [
  {
    key: "minsApp",
    label: "Mins/App",
    digits: 1,
    get: (p) => minsPerApp(p),
  },
  {
    key: "xgi",
    label: "xGI",
    digits: 2,
    get: (p, mode) => scaleValue(p.xGI, p.mins, mode),
  },
  {
    key: "bccKp",
    label: "BCC + KP",
    digits: 0,
    get: (p, mode) => scaleValue(bccKpTotal(p), p.mins, mode),
  },
  {
    key: "setPieces",
    label: "Set Pieces",
    digits: 0,
    get: (p, mode) => scaleValue(setPiecesTotal(p), p.mins, mode),
  },
];

const DEFENSIVE_RADAR_AXES: RadarAxisDef[] = [
  {
    key: "dcg",
    label: "DC/G",
    digits: 2,
    get: (p) => p.dcPerGame,
  },
  ...SHARED_RADAR_AXES,
  {
    key: "cs",
    label: "CS",
    digits: 0,
    get: (p, mode) => scaleValue(p.cleanSheets ?? 0, p.mins, mode),
  },
];

const ATTACKING_RADAR_AXES: RadarAxisDef[] = [
  {
    key: "ga",
    label: "G+A",
    digits: 0,
    get: (p, mode) => scaleValue(p.gi, p.mins, mode),
  },
  ...SHARED_RADAR_AXES,
  {
    key: "shots",
    label: "Shots",
    digits: 0,
    get: (p, mode) => scaleValue(p.shots, p.mins, mode),
  },
];

/** Defensive set when neither player is FWD; otherwise attacking (incl. DEF vs FWD). */
export function radarAxisSetForPair(a: Position, b: Position): RadarAxisSet {
  if (a === "FWD" || b === "FWD") return "attacking";
  return "defensive";
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
    id: "attack",
    title: "1. Attacking Forensics & Goal Threat",
    metrics: [
      {
        key: "xG",
        label: "Expected Goals (xG)",
        get: (p, mode) => scaleValue(p.xG, p.mins, mode),
      },
      {
        key: "shots",
        label: "Total Shots",
        digits: 2,
        get: (p, mode) => scaleValue(p.shots, p.mins, mode),
      },
      {
        key: "sot",
        label: "Shots on Target (SoT)",
        get: (p, mode) => scaleValue(p.shotsOnTarget, p.mins, mode),
      },
      {
        key: "sib",
        label: "Shots in Box (SIB)",
        get: (p, mode) => scaleValue(p.shotsInsideBox, p.mins, mode),
      },
      {
        key: "bc",
        label: "Big Chances (BC)",
        get: (p, mode) => scaleValue(p.bigChances, p.mins, mode),
      },
      {
        key: "npxG",
        label: "Non-Penalty xG (npxG)",
        get: (p, mode) => scaleValue(approxNpxG(p), p.mins, mode),
      },
      {
        key: "conv",
        label: "Shot Conversion %",
        format: "percent",
        digits: 1,
        get: (p) => shotConversion(p),
      },
      {
        key: "goals",
        label: "Goals",
        digits: 0,
        get: (p, mode) => scaleValue(p.goals, p.mins, mode),
      },
    ],
  },
  {
    id: "creativity",
    title: "2. Creativity, Passing & Transition Service",
    metrics: [
      {
        key: "xA",
        label: "Expected Assists (xA)",
        get: (p, mode) => scaleValue(p.xA, p.mins, mode),
      },
      {
        key: "kp",
        label: "Key Passes (KP)",
        get: (p, mode) => scaleValue(p.keyPasses, p.mins, mode),
      },
      {
        key: "bcc",
        label: "Big Chances Created (BCC)",
        get: (p, mode) => scaleValue(p.bigChancesCreated, p.mins, mode),
      },
      {
        key: "assists",
        label: "Assists",
        digits: 0,
        get: (p, mode) => scaleValue(p.assists, p.mins, mode),
      },
      {
        key: "xGI",
        label: "Expected Goal Involvement (xGI)",
        get: (p, mode) => scaleValue(p.xGI, p.mins, mode),
      },
    ],
  },
  {
    id: "value",
    title: "3. Ball Winning & Schedule Toughness",
    metrics: [
      {
        key: "rec",
        label: "Recoveries",
        get: (p, mode) => scaleValue(p.recoveries, p.mins, mode),
      },
      {
        key: "tck",
        label: "Tackles",
        get: (p, mode) => scaleValue(p.tackles, p.mins, mode),
      },
      {
        key: "int",
        label: "Interceptions",
        get: (p, mode) => scaleValue(p.interceptions, p.mins, mode),
      },
      {
        key: "clr",
        label: "Clearances",
        get: (p, mode) => scaleValue(p.clearances, p.mins, mode),
      },
      {
        key: "fdr",
        label: "Next 3 FDR Rating",
        lowerIsBetter: true,
        digits: 2,
        get: (p) => avgNextFdr(p, "overall"),
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
