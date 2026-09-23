import type {
  PlayerRow,
  Position,
  SquadMissingSlot,
  SquadPlayerId,
} from "@/lib/types";
import {
  MAX_PLAYERS_PER_TEAM,
  SQUAD_POSITION_LIMITS,
  SQUAD_POSITION_ORDER,
  SQUAD_SIZE,
} from "@/lib/types";

export function isSquadPlayerId(value: unknown): value is SquadPlayerId {
  return typeof value === "string" && value.includes(":") && value.length > 2;
}

/** Sanitize localStorage payload into a unique list of valid composite ids (max 15). */
export function normalizeSquadIds(raw: unknown): SquadPlayerId[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: SquadPlayerId[] = [];
  for (const item of raw) {
    if (!isSquadPlayerId(item)) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
    if (out.length >= SQUAD_SIZE) break;
  }
  return out;
}

export function countByPosition(
  players: PlayerRow[]
): Record<Position, number> {
  const counts: Record<Position, number> = {
    GKP: 0,
    DEF: 0,
    MID: 0,
    FWD: 0,
  };
  for (const p of players) {
    counts[p.position] += 1;
  }
  return counts;
}

export function countByTeam(players: PlayerRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of players) {
    counts[p.teamId] = (counts[p.teamId] ?? 0) + 1;
  }
  return counts;
}

export type AddPlayerBlockReason =
  | "already_selected"
  | "squad_full"
  | "position_full"
  | "team_full";

export function canAddPlayer(
  squadPlayers: PlayerRow[],
  candidate: PlayerRow
): { ok: true } | { ok: false; reason: AddPlayerBlockReason } {
  if (squadPlayers.some((p) => p.id === candidate.id)) {
    return { ok: false, reason: "already_selected" };
  }
  if (squadPlayers.length >= SQUAD_SIZE) {
    return { ok: false, reason: "squad_full" };
  }
  const posCount = countByPosition(squadPlayers)[candidate.position];
  if (posCount >= SQUAD_POSITION_LIMITS[candidate.position]) {
    return { ok: false, reason: "position_full" };
  }
  const teamCount = countByTeam(squadPlayers)[candidate.teamId] ?? 0;
  if (teamCount >= MAX_PLAYERS_PER_TEAM) {
    return { ok: false, reason: "team_full" };
  }
  return { ok: true };
}

export function addPlayerBlockLabel(reason: AddPlayerBlockReason): string {
  switch (reason) {
    case "already_selected":
      return "Already in squad";
    case "squad_full":
      return "Squad full (15/15)";
    case "position_full":
      return "Position full";
    case "team_full":
      return "Max 3 from this club";
  }
}

/** Sort squad rows GKP → DEF → MID → FWD, then by name. */
export function sortSquadPlayers(players: PlayerRow[]): PlayerRow[] {
  const posRank = Object.fromEntries(
    SQUAD_POSITION_ORDER.map((p, i) => [p, i])
  ) as Record<Position, number>;
  return [...players].sort((a, b) => {
    const pr = posRank[a.position] - posRank[b.position];
    if (pr !== 0) return pr;
    return a.name.localeCompare(b.name);
  });
}

/** Missing position slots for mini-bar chips and table placeholders. */
export function getMissingSlots(players: PlayerRow[]): SquadMissingSlot[] {
  const counts = countByPosition(players);
  const missing: SquadMissingSlot[] = [];
  for (const position of SQUAD_POSITION_ORDER) {
    const limit = SQUAD_POSITION_LIMITS[position];
    const have = counts[position];
    for (let slotIndex = have + 1; slotIndex <= limit; slotIndex++) {
      missing.push({
        position,
        slotIndex,
        key: `empty:${position}:${slotIndex}`,
      });
    }
  }
  return missing;
}

export function chipShortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  const last = parts[parts.length - 1]!;
  if (last.length > 12) return `${last.slice(0, 10)}.`;
  return last;
}
