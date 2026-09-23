/**
 * Extract seasonStatsRaw / expectedGoalsRaw from data/store.json
 * into data/extracted/Round N/{SeasonStats|ExpectedGoals} - CODE.json
 */
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { TEAM_ID_TO_CODE } from "../lib/constants/teams.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const storePath = path.join(root, "data", "store.json");
const outRoot = path.join(root, "data", "extracted");

function safeName(code: string, teamName: string, teamId: string): string {
  const fromCode = code?.trim();
  if (fromCode && fromCode !== "UNK") return fromCode;
  const fromName = teamName?.replace(/[<>:"/\\|?*]/g, "").trim();
  if (fromName) return fromName;
  return teamId.slice(0, 12) || "unknown";
}

type Snap = {
  throughGameweek: number;
  teamId: string;
  teamName: string;
  shortName: string;
  seasonStatsRaw?: unknown;
  expectedGoalsRaw?: unknown;
};

const store = JSON.parse(await fs.readFile(storePath, "utf8")) as {
  snapshots: Snap[];
};

const summary: Record<
  number,
  { season: string[]; expected: string[]; missingSeason: string[]; missingExpected: string[] }
> = {};

for (const snap of store.snapshots) {
  const gw = snap.throughGameweek;
  if (!summary[gw]) {
    summary[gw] = { season: [], expected: [], missingSeason: [], missingExpected: [] };
  }
  const code = TEAM_ID_TO_CODE[snap.teamId] || snap.shortName || "UNK";
  const label = safeName(code, snap.teamName, snap.teamId);
  const dir = path.join(outRoot, `Round ${gw}`);
  await fs.mkdir(dir, { recursive: true });

  if (snap.seasonStatsRaw) {
    const file = path.join(dir, `SeasonStats - ${label}.json`);
    await fs.writeFile(file, JSON.stringify(snap.seasonStatsRaw, null, 2), "utf8");
    summary[gw].season.push(label);
  } else {
    summary[gw].missingSeason.push(label);
  }

  if (snap.expectedGoalsRaw) {
    const file = path.join(dir, `ExpectedGoals - ${label}.json`);
    await fs.writeFile(file, JSON.stringify(snap.expectedGoalsRaw, null, 2), "utf8");
    summary[gw].expected.push(label);
  } else {
    summary[gw].missingExpected.push(label);
  }
}

const gws = Object.keys(summary)
  .map(Number)
  .sort((a, b) => a - b);

console.log(`Extracted to ${outRoot}`);
for (const gw of gws) {
  const s = summary[gw];
  console.log(
    `GW${gw}: SeasonStats ${s.season.length}, ExpectedGoals ${s.expected.length}` +
      (s.missingSeason.length ? ` | missing SS: ${s.missingSeason.join(",")}` : "") +
      (s.missingExpected.length ? ` | missing EG: ${s.missingExpected.join(",")}` : "")
  );
  console.log(`  SS: ${s.season.sort().join(", ")}`);
  console.log(`  EG: ${s.expected.sort().join(", ")}`);
}
