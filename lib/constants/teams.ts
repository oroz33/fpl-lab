export const PL_TEAMS = [
  { id: "ars", name: "Arsenal", shortName: "ARS" },
  { id: "avl", name: "Aston Villa", shortName: "AVL" },
  { id: "bou", name: "Bournemouth", shortName: "BOU" },
  { id: "bre", name: "Brentford", shortName: "BRE" },
  { id: "bha", name: "Brighton", shortName: "BHA" },
  { id: "che", name: "Chelsea", shortName: "CHE" },
  { id: "cry", name: "Crystal Palace", shortName: "CRY" },
  { id: "eve", name: "Everton", shortName: "EVE" },
  { id: "ful", name: "Fulham", shortName: "FUL" },
  { id: "ips", name: "Ipswich", shortName: "IPS" },
  { id: "lei", name: "Leicester", shortName: "LEI" },
  { id: "liv", name: "Liverpool", shortName: "LIV" },
  { id: "mci", name: "Man City", shortName: "MCI" },
  { id: "mun", name: "Man Utd", shortName: "MUN" },
  { id: "new", name: "Newcastle", shortName: "NEW" },
  { id: "nfo", name: "Nott'm Forest", shortName: "NFO" },
  { id: "sou", name: "Southampton", shortName: "SOU" },
  { id: "tot", name: "Spurs", shortName: "TOT" },
  { id: "whu", name: "West Ham", shortName: "WHU" },
  { id: "wol", name: "Wolves", shortName: "WOL" },
] as const;

/** 3-letter Opta code → display name + accent hex (2026/27 squad). */
export const TEAM_ACCENTS: Record<string, { name: string; accent: string }> = {
  ARS: { name: "Arsenal", accent: "#EF0107" },
  AVL: { name: "Aston Villa", accent: "#95BFE5" },
  BHA: { name: "Brighton", accent: "#0057B8" },
  BOU: { name: "Bournemouth", accent: "#DA291C" },
  BRE: { name: "Brentford", accent: "#E30613" },
  CHE: { name: "Chelsea", accent: "#034694" },
  COV: { name: "Coventry", accent: "#77C7F2" },
  CRY: { name: "Crystal Palace", accent: "#1B458F" },
  EVE: { name: "Everton", accent: "#003399" },
  FUL: { name: "Fulham", accent: "#000000" },
  HUL: { name: "Hull City", accent: "#F5A12D" },
  IPS: { name: "Ipswich", accent: "#0044AA" },
  LEE: { name: "Leeds", accent: "#FFCD00" },
  LIV: { name: "Liverpool", accent: "#C8102E" },
  MCI: { name: "Man City", accent: "#6CABDD" },
  MUN: { name: "Man Utd", accent: "#DA291C" },
  NEW: { name: "Newcastle", accent: "#241F20" },
  NFO: { name: "Nott'm Forest", accent: "#DD0000" },
  SUN: { name: "Sunderland", accent: "#EB172B" },
  TOT: { name: "Spurs", accent: "#132257" },
};

/** Opta contestant id → 3-letter code (2026/27). */
export const TEAM_ID_TO_CODE: Record<string, string> = {
  "4dsgumo7d4zupm2ugsvm4zm4d": "ARS",
  "b496gs285it6bheuikox6z9mj": "AVL",
  "e5p0ehyguld7egzhiedpdnc3w": "BHA",
  "1pse9ta7a45pi2w2grjim70ge": "BOU",
  "7yx5dqhhphyvfisohikodajhv": "BRE",
  "9q0arba2kbnywth8bkxlhgmdr": "CHE",
  "dacoc20k0n3fxu4zek8wufmko": "COV",
  "1c8m2ko0wxq1asfkuykurdr0y": "CRY",
  "ehd2iemqmschhj2ec0vayztzz": "EVE",
  "hzqh7z0mdl3v7gwete66syxp": "FUL",
  "f0figafm2v9h8ofo6slajj7xf": "HUL",
  "8b523ujgl21tbc01me65q0aoh": "IPS",
  "48gk2hpqtsl6p9sx9kjhaydq4": "LEE",
  "c8h9bw1l82s06h77xxrelzhur": "LIV",
  "a3nyxabgsqlnqfkeg41m6tnpp": "MCI",
  "6eqit8ye8aomdsrrq0hk3v7gh": "MUN",
  "7vn2i2kd35zuetw6b38gw9jsz": "NEW",
  "1qtaiy11gswx327s0vkibf70n": "NFO",
  "1r3545b2dzan8yqa80gtmcjch": "SUN",
  "22doj4sgsocqpxw45h607udje": "TOT",
};

const FALLBACK_ACCENT = "#64748B";

/**
 * Resolve display shortName / name from Opta contestant id.
 * Prefer the 3-letter code map so SeasonStats-only feeds (missing optaSymId)
 * still show ARS/MCI/… instead of UNK.
 */
export function resolveTeamIdentity(input: {
  teamId?: string;
  name?: string;
  shortName?: string;
}): { teamId: string; name: string; shortName: string; code?: string } {
  const teamId = input.teamId?.trim() || "unknown";
  const code = TEAM_ID_TO_CODE[teamId];
  const fromCode = code ? TEAM_ACCENTS[code] : undefined;
  const rawShort = input.shortName?.trim();
  const usableRaw =
    rawShort && rawShort.toUpperCase() !== "UNK" ? rawShort : undefined;

  // Prefer canonical 3-letter code when we know the Opta id.
  const shortName = code || usableRaw || "UNK";
  const name = input.name?.trim() || fromCode?.name || "Unknown Team";

  return { teamId, name, shortName, code };
}

/** Resolve accent hex from Opta teamId and/or 3-letter code. */
export function resolveTeamAccent(input: {
  teamId?: string;
  code?: string;
}): string {
  const code =
    (input.code && input.code.toUpperCase()) ||
    (input.teamId ? TEAM_ID_TO_CODE[input.teamId] : undefined);
  if (code && TEAM_ACCENTS[code]) return TEAM_ACCENTS[code].accent;
  return FALLBACK_ACCENT;
}

export const POSITION_COLORS: Record<string, string> = {
  GKP: "bg-amber-100 text-amber-900 border-amber-300",
  DEF: "bg-sky-100 text-sky-900 border-sky-300",
  MID: "bg-emerald-100 text-emerald-900 border-emerald-300",
  FWD: "bg-rose-100 text-rose-900 border-rose-300",
};
