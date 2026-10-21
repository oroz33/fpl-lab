/**
 * Replace local data/store.json snapshots for GW3–GW6 with the extracted
 * cumulative Opta files. Does not read or write Vercel Blob.
 *
 * Usage: npx tsx scripts/rebuild-local-rounds.mts
 */
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildSnapshotFromRaw, readStore, writeStore } from "../lib/store/db.ts";

delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.VERCEL;
process.env.NODE_ENV = "development";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const extracted = path.join(root, "data", "extracted");
const rounds = [3, 4, 5, 6] as const;

function countByGw(snapshots: { throughGameweek: number }[]) {
  const gws: Record<number, number> = {};
  for (const snapshot of snapshots) {
    gws[snapshot.throughGameweek] = (gws[snapshot.throughGameweek] ?? 0) + 1;
  }
  return gws;
}

const store = await readStore({ fresh: true });
const before = store.snapshots.length;
console.log(`before: ${before} snapshots`, countByGw(store.snapshots));

let replaced = 0;
let added = 0;

for (const gw of rounds) {
  const dir = path.join(extracted, `Round ${gw}`);
  const seasonFiles = (await fs.readdir(dir))
    .filter((name) => name.startsWith("SeasonStats - ") && name.endsWith(".json"))
    .sort();

  if (seasonFiles.length !== 20) {
    throw new Error(`Round ${gw} has ${seasonFiles.length} SeasonStats files, expected 20`);
  }

  for (const seasonFile of seasonFiles) {
    const code = seasonFile.slice("SeasonStats - ".length, -".json".length);
    const xgFile = `ExpectedGoals - ${code}.json`;
    const [seasonText, xgText] = await Promise.all([
      fs.readFile(path.join(dir, seasonFile), "utf8"),
      fs.readFile(path.join(dir, xgFile), "utf8"),
    ]);
    const snapshot = buildSnapshotFromRaw({
      throughGameweek: gw,
      seasonStatsRaw: JSON.parse(seasonText),
      expectedGoalsRaw: JSON.parse(xgText),
    });
    const idx = store.snapshots.findIndex(
      (existing) =>
        existing.teamId === snapshot.teamId &&
        existing.throughGameweek === snapshot.throughGameweek
    );
    if (idx >= 0) {
      store.snapshots[idx] = snapshot;
      replaced += 1;
    } else {
      store.snapshots.push(snapshot);
      added += 1;
    }
  }
}

store.snapshots.sort(
  (a, b) => a.teamId.localeCompare(b.teamId) || a.throughGameweek - b.throughGameweek
);

if (store.snapshots.length !== before || added !== 0 || replaced !== 80) {
  throw new Error(
    `Refusing to write: before=${before} after=${store.snapshots.length} replaced=${replaced} added=${added}`
  );
}

await writeStore(store);
console.log(`wrote ${store.snapshots.length} snapshots (replaced ${replaced})`, countByGw(store.snapshots));
