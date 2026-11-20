export type GraphEntity = "players" | "teams";

export interface AxisMetric {
  key: string;
  label: string;
  description: string;
  group: string;
}

export const PLAYER_AXIS_METRICS: AxisMetric[] = [
  // Attack
  { key: "shots", label: "Shots", description: "Total shots taken", group: "Attack" },
  { key: "shotsOnTarget", label: "SoT", description: "Shots on Target", group: "Attack" },
  { key: "shotsInsideBox", label: "SIB", description: "Shots in Box", group: "Attack" },
  { key: "bigChances", label: "BC", description: "Big Chances", group: "Attack" },
  { key: "xG", label: "xG", description: "Expected Goals", group: "Attack" },
  { key: "goals", label: "G", description: "Goals", group: "Attack" },
  { key: "xGI", label: "xGI", description: "Expected Goals Involvement", group: "Attack" },
  { key: "npxGI", label: "npxGI", description: "Non-Penalty Expected Goals Involvement", group: "Attack" },
  { key: "gi", label: "GI", description: "Goals Involvement (G+A)", group: "Attack" },
  {
    key: "xGiVariance",
    label: "Δ xGI",
    description: "Actual Returns (G+A) minus xGI",
    group: "Attack",
  },
  { key: "keyPasses", label: "KP", description: "Key Passes", group: "Attack" },
  { key: "bigChancesCreated", label: "BCC", description: "Big Chance Created", group: "Attack" },
  { key: "xA", label: "xA", description: "Expected Assists", group: "Attack" },
  { key: "assists", label: "A", description: "Assists", group: "Attack" },
  { key: "apps", label: "Apps", description: "Appearances", group: "General" },
  { key: "mins", label: "Mins", description: "Minutes played", group: "General" },
  // Set Pieces
  { key: "corners", label: "Corners", description: "Corners taken", group: "Set Pieces" },
  { key: "freeKicksTaken", label: "FK Taken", description: "Free Kicks Taken", group: "Set Pieces" },
  { key: "freeKickGoals", label: "FK Goals", description: "Free Kick Goals", group: "Set Pieces" },
  { key: "penaltyGoals", label: "Pens", description: "Penalty Goals", group: "Set Pieces" },
  // Defending
  { key: "clearances", label: "Clr", description: "Clearances", group: "Defending" },
  { key: "blocks", label: "Blk", description: "Blocks", group: "Defending" },
  { key: "interceptions", label: "Int", description: "Interceptions", group: "Defending" },
  { key: "tackles", label: "Tck", description: "Tackles", group: "Defending" },
  { key: "recoveries", label: "Rec", description: "Recoveries", group: "Defending" },
  { key: "dcPerGame", label: "DC/G", description: "Defensive Actions per Game", group: "Defending" },
  { key: "cleanSheets", label: "CS", description: "Clean Sheets", group: "Defending" },
  { key: "saves", label: "Saves", description: "Saves", group: "Defending" },
];

export const TEAM_AXIS_METRICS: AxisMetric[] = [
  { key: "xG", label: "xG", description: "Expected Goals", group: "Offensive" },
  { key: "goals", label: "G", description: "Goals", group: "Offensive" },
  { key: "deltaG", label: "ΔG", description: "Goal Delta (G − xG)", group: "Offensive" },
  { key: "xGC", label: "xGC", description: "Expected Goals Conceded", group: "Defensive" },
  { key: "goalsConceded", label: "GC", description: "Goals Conceded", group: "Defensive" },
  { key: "deltaGC", label: "ΔGC", description: "Conceded Delta (xGC − GC)", group: "Defensive" },
  { key: "xCS", label: "xCS", description: "Expected Clean Sheets", group: "Defensive" },
  { key: "cleanSheets", label: "CS", description: "Clean Sheets", group: "Defensive" },
  { key: "deltaCS", label: "ΔCS", description: "Clean Sheet Delta (CS − xCS)", group: "Defensive" },
  { key: "gamesPlayed", label: "GP", description: "Games Played", group: "General" },
];

export function axisMetricsFor(entity: GraphEntity): AxisMetric[] {
  return entity === "players" ? PLAYER_AXIS_METRICS : TEAM_AXIS_METRICS;
}

export function findAxisMetric(
  entity: GraphEntity,
  key: string
): AxisMetric | undefined {
  return axisMetricsFor(entity).find((m) => m.key === key);
}

export function defaultAxisKeys(entity: GraphEntity): { xKey: string; yKey: string } {
  if (entity === "players") return { xKey: "xG", yKey: "goals" };
  return { xKey: "goalsConceded", yKey: "cleanSheets" };
}
