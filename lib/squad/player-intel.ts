import playerNews from "@/data/player-news.json";
import type {
  ExpectedXiStatus,
  FitnessTone,
  PlayerIntel,
  PlayerRow,
  Position,
} from "@/lib/types";

type NewsDefault = {
  expectedXi: ExpectedXiStatus;
  fitnessLabel: string;
  fitnessTone: FitnessTone;
  quote: string;
};

type PlayerNewsFile = {
  managersByCode: Record<string, string>;
  playersByKey: Record<string, PlayerIntel>;
  defaultsByPosition: Record<Position, NewsDefault>;
};

const news = playerNews as PlayerNewsFile;

function slugToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Build lookup keys from display name + team short (e.g. ars:saka, ars:gabriel). */
export function playerNewsKeys(player: PlayerRow): string[] {
  const team = player.teamShort.trim().toLowerCase();
  const parts = player.name.trim().split(/\s+/).filter(Boolean);
  const last = parts[parts.length - 1] ?? player.name;
  const first = parts[0] ?? "";
  const keys = new Set<string>();
  keys.add(`${team}:${slugToken(last)}`);
  if (parts.length >= 2) {
    keys.add(`${team}:${slugToken(parts.slice(1).join("-"))}`);
    keys.add(`${team}:${slugToken(`${first[0]}-${last}`)}`);
  }
  // Double-barrel / hyphenated surnames: also try first segment after hyphen
  const lastSlug = slugToken(last);
  if (lastSlug.includes("-")) {
    keys.add(`${team}:${lastSlug.split("-")[0]}`);
  }
  return [...keys];
}

export function resolvePlayerIntel(player: PlayerRow): PlayerIntel {
  // Exact composite id if ever seeded
  const byId = news.playersByKey[player.id];
  if (byId) return byId;

  for (const key of playerNewsKeys(player)) {
    const hit = news.playersByKey[key];
    if (hit) return hit;
  }

  const code = player.teamShort.trim().toUpperCase();
  const managerName =
    news.managersByCode[code] ??
    news.managersByCode[player.teamShort] ??
    "Manager";
  const fallback = news.defaultsByPosition[player.position] ?? {
    expectedXi: "STARTER" as const,
    fitnessLabel: "100% FIT",
    fitnessTone: "fit" as const,
    quote: "Available for selection.",
  };

  return {
    expectedXi: fallback.expectedXi,
    fitnessLabel: fallback.fitnessLabel,
    fitnessTone: fallback.fitnessTone,
    managerName,
    quote: fallback.quote,
  };
}

export function expectedXiLabel(status: ExpectedXiStatus): string {
  switch (status) {
    case "STARTER":
      return "STARTER";
    case "ROTATION_RISK":
      return "ROTATION RISK";
    case "RULED_OUT":
      return "RULED OUT";
  }
}
