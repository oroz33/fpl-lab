import type { ParsedPlayer, ParsedTeam, StatMap } from "@/lib/types";
import { displayName, mapPlayerPosition } from "@/lib/mapping/positions";

function parseNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Convert Opta ExpectedGoals `{type,value}[]` into a flat numeric map. */
export function expectedStatArrayToMap(
  stats?: Array<{ type?: string; value?: string | number }>
): StatMap {
  const map: StatMap = {};
  if (!Array.isArray(stats)) return map;
  for (const entry of stats) {
    if (!entry?.type) continue;
    // Skip non-numeric metadata fields
    if (
      entry.type.startsWith("player") ||
      entry.type === "playerFirstName" ||
      entry.type === "playerLastName" ||
      entry.type === "playerKnownName"
    ) {
      continue;
    }
    map[entry.type] = parseNumber(entry.value);
  }
  return map;
}

export function parseExpectedGoals(raw: unknown): {
  team: ParsedTeam;
  players: ParsedPlayer[];
} {
  const data = raw as {
    contestant?: {
      id?: string;
      name?: string;
      optaShortName?: string;
      optaSymId?: string;
      stat?: Array<{ type?: string; value?: string | number }>;
    };
    player?: Array<{
      id?: string;
      position?: string;
      firstName?: string;
      lastName?: string;
      shortFirstName?: string;
      shortLastName?: string;
      knownName?: string;
      matchName?: string;
      shirtNumber?: string;
      stat?: Array<{ type?: string; value?: string | number }>;
    }>;
  };

  const contestant = data.contestant ?? {};
  const teamStats = expectedStatArrayToMap(contestant.stat);

  const players: ParsedPlayer[] = (data.player ?? [])
    .filter((p) => p.id)
    .map((p) => ({
      id: p.id!,
      firstName: p.firstName ?? "",
      lastName: p.lastName ?? "",
      matchName: p.matchName ?? "",
      knownName: p.knownName,
      displayName: displayName(p),
      position: mapPlayerPosition(p.id, p.position),
      shirtNumber: p.shirtNumber,
      stats: expectedStatArrayToMap(p.stat),
    }));

  const team: ParsedTeam = {
    id: contestant.id ?? "unknown",
    name: contestant.name ?? "Unknown Team",
    shortName: contestant.optaShortName || contestant.optaSymId || "UNK",
    stats: teamStats,
  };

  return { team, players };
}
