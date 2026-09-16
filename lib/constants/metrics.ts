export const METRIC_DESCRIPTIONS: Record<string, string> = {
  // Attack
  Shots: "Shots",
  SoT: "Shots on Target",
  SIB: "Shots in Box",
  BC: "Big Chances",
  xG: "Expected Goals",
  xA: "Expected Assists",
  xGI: "Expected Goals Involvement",
  npxGI: "Non-Penalty Expected Goals Involvement",
  G: "Goals",
  A: "Assists",
  GI: "Goals Involvement",
  KP: "Key Passes",
  BCC: "Big Chance Created",
  // Defending
  Clr: "Clearances",
  Blk: "Blocks",
  Int: "Interceptions",
  Tck: "Tackles",
  Rec: "Recoveries",
  "DC/G": "Defensive Actions per Game",
  CS: "Clean Sheets",
  Saves: "Saves",
  // Teams
  xGC: "Expected Goals Conceded",
  GC: "Goals Conceded",
  "ΔG": "Goal Delta",
  "ΔGC": "Conceded Delta",
  xCS: "Expected Clean Sheets",
  "ΔCS": "Clean Sheet Delta",
  // Set Pieces
  Corners: "Corners",
  "FK Taken": "Free Kicks Taken",
  "FK Goals": "Free Kick Goals",
  Pens: "Penalties",
};

export function metricDescription(label: string): string | undefined {
  return METRIC_DESCRIPTIONS[label];
}
