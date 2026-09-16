import type { Position } from "@/lib/types";

/** Project-level position overrides for players whose FPL role differs from Opta. */
const POSITION_OVERRIDES: Record<string, Position> = {
  // Matheus Nunes is a Defender in FPL, despite Opta listing him as a Midfielder.
  "3trkre1c81pzretsjsi8jk6sq": "DEF",
};

export function mapOptaPosition(raw?: string): Position {
  const value = (raw ?? "").toLowerCase();
  if (value.includes("goalkeeper") || value === "gkp" || value === "gk") return "GKP";
  if (value.includes("defender") || value === "def") return "DEF";
  if (value.includes("midfielder") || value === "mid") return "MID";
  if (value.includes("forward") || value.includes("striker") || value === "fwd") return "FWD";
  return "MID";
}

export function mapPlayerPosition(id: string | undefined, raw?: string): Position {
  return (id && POSITION_OVERRIDES[id]) || mapOptaPosition(raw);
}

export function displayName(player: {
  knownName?: string;
  matchName?: string;
  firstName?: string;
  lastName?: string;
  shortFirstName?: string;
  shortLastName?: string;
}): string {
  if (player.knownName) return player.knownName;
  if (player.matchName) return player.matchName;
  const first = player.shortFirstName || player.firstName || "";
  const last = player.shortLastName || player.lastName || "";
  return `${first} ${last}`.trim() || "Unknown";
}
