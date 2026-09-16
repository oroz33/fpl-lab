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

/** Convert Opta SeasonStats `{name,value}[]` into a flat numeric map. */
export function seasonStatArrayToMap(
  stats?: Array<{ name?: string; value?: string | number }>
): StatMap {
  const map: StatMap = {};
  if (!Array.isArray(stats)) return map;
  for (const entry of stats) {
    if (!entry?.name) continue;
    map[entry.name.trim()] = parseNumber(entry.value);
  }
  return map;
}

export function parseSeasonStats(raw: unknown): {
  team: ParsedTeam;
  players: ParsedPlayer[];
} {
  const data = raw as {
    contestant?: {
      id?: string;
      name?: string;
      optaShortName?: string;
      optaSymId?: string;
      stat?: Array<{ name?: string; value?: string | number }>;
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
      currentTeamOnly?: {
        stat?: Array<{ name?: string; value?: string | number }>;
      };
      stat?: Array<{ name?: string; value?: string | number }>;
    }>;
  };

  const contestant = data.contestant ?? {};
  const teamStats = seasonStatArrayToMap(contestant.stat);

  // Prefer currentTeamOnly when present (players who transferred mid-season).
  // If currentTeamOnly exists with Appearances/Games Played == 0, the player
  // left (or never featured for) this club — exclude them instead of falling
  // back to full-season totals that belong to another team.
  const players: ParsedPlayer[] = (data.player ?? [])
    .filter((p) => p.id)
    .flatMap((p) => {
      const ctoStat = p.currentTeamOnly?.stat;
      const hasCurrentAppsField =
        !!ctoStat &&
        ctoStat.some(
          (s) => s.name === "Appearances" || s.name === "Games Played"
        );

      let stats: StatMap;
      if (hasCurrentAppsField) {
        const ctoMap = seasonStatArrayToMap(ctoStat);
        const apps = ctoMap["Appearances"] ?? ctoMap["Games Played"] ?? 0;
        if (apps <= 0) return [];
        stats = ctoMap;
      } else {
        stats = seasonStatArrayToMap(p.stat);
      }

      return [
        {
          id: p.id!,
          firstName: p.firstName ?? "",
          lastName: p.lastName ?? "",
          matchName: p.matchName ?? "",
          knownName: p.knownName,
          displayName: displayName(p),
          position: mapPlayerPosition(p.id, p.position),
          shirtNumber: p.shirtNumber,
          stats,
        },
      ];
    })
    // Keep players with any appearances or meaningful minutes
    .filter(
      (p) =>
        (p.stats["Appearances"] ?? p.stats["Games Played"] ?? 0) > 0 ||
        Object.keys(p.stats).length > 0
    );

  const team: ParsedTeam = {
    id: contestant.id ?? "unknown",
    name: contestant.name ?? "Unknown Team",
    shortName: contestant.optaShortName || contestant.optaSymId || "UNK",
    stats: teamStats,
  };

  return { team, players };
}
