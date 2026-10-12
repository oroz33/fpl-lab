/**
 * Ingest all Opta JSON files from a Round folder into the active store
 * (local data/store.json, or Vercel Blob when BLOB_READ_WRITE_TOKEN is set).
 *
 * Usage:
 *   npx tsx scripts/ingest-round-folder.mts --dir "data/Round 6" --gw 6
 *
 * Kind is detected from file content (not folder name), so misplaced
 * seasonstats/xg files are still paired correctly by contestant.id.
 */
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  parseBatchFile,
  pairBatchFiles,
  type ParsedBatchFile,
} from "../lib/ingest/batch.ts";
import {
  buildSnapshotFromRaw,
  getStorageMode,
  upsertSnapshot,
} from "../lib/store/db.ts";
import { getMetaFromSnapshots } from "../lib/delta/engine.ts";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Minimal .env loader (KEY=VALUE, # comments, optional quotes). */
async function loadEnvFile(filePath: string): Promise<void> {
  try {
    const text = await fs.readFile(filePath, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (value !== "") {
        process.env[key] = value;
      } else if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? err.code : null;
    if (code !== "ENOENT") throw err;
  }
}

function parseArgs(argv: string[]) {
  let dir = "";
  let gw = NaN;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dir" && argv[i + 1]) {
      dir = argv[++i];
    } else if (a === "--gw" && argv[i + 1]) {
      gw = Number(argv[++i]);
    }
  }
  if (!dir || !Number.isFinite(gw) || gw < 1 || gw > 38) {
    console.error(
      'Usage: npx tsx scripts/ingest-round-folder.mts --dir "data/Round 6" --gw 6'
    );
    process.exit(1);
  }
  return { dir, gw };
}

async function collectJsonFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(current: string) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(current, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else if (e.isFile() && e.name.toLowerCase().endsWith(".json")) {
        out.push(full);
      }
    }
  }
  await walk(dir);
  return out.sort();
}

async function main() {
  await loadEnvFile(path.join(root, ".env.local"));
  await loadEnvFile(path.join(root, ".env"));

  const { dir: dirArg, gw } = parseArgs(process.argv.slice(2));
  const dir = path.isAbsolute(dirArg) ? dirArg : path.join(root, dirArg);
  console.log(`storageMode: ${getStorageMode()}`);

  const files = await collectJsonFiles(dir);
  if (files.length === 0) {
    console.error(`No JSON files found under ${dir}`);
    process.exit(1);
  }

  const seasonFiles: ParsedBatchFile[] = [];
  const xgFiles: ParsedBatchFile[] = [];
  const unknown: string[] = [];

  for (const file of files) {
    const text = await fs.readFile(file, "utf8");
    const relative = path.relative(dir, file);
    try {
      const parsed = parseBatchFile(relative, text);
      if (parsed.kind === "seasonStats") seasonFiles.push(parsed);
      else if (parsed.kind === "expectedGoals") xgFiles.push(parsed);
      else unknown.push(relative);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Failed to parse ${relative}: ${message}`);
      unknown.push(relative);
    }
  }

  const bundles = pairBatchFiles(seasonFiles, xgFiles);
  const results: Array<{
    team: string;
    players: number;
    hasSS: boolean;
    hasXG: boolean;
  }> = [];

  let store = null;
  for (const bundle of bundles) {
    const snapshot = buildSnapshotFromRaw({
      throughGameweek: gw,
      seasonStatsRaw: bundle.seasonStats,
      expectedGoalsRaw: bundle.expectedGoals,
    });
    store = await upsertSnapshot(snapshot);
    results.push({
      team: snapshot.teamName,
      players: snapshot.players.length,
      hasSS: Boolean(bundle.seasonStats),
      hasXG: Boolean(bundle.expectedGoals),
    });
    console.log(
      `OK  GW${gw}  ${snapshot.shortName.padEnd(3)}  ${snapshot.teamName}  players=${snapshot.players.length}` +
        (!bundle.seasonStats ? "  [missing SS]" : "") +
        (!bundle.expectedGoals ? "  [missing XG]" : "")
    );
  }

  const meta = store
    ? getMetaFromSnapshots(store.snapshots)
    : { maxGameweek: 0, minGameweek: 0, teams: [] };
  const incomplete = results.filter((r) => !r.hasSS || !r.hasXG);

  console.log("\n--- summary ---");
  console.log(`dir: ${dir}`);
  console.log(`files: ${files.length} (SS=${seasonFiles.length}, XG=${xgFiles.length}, unknown=${unknown.length})`);
  console.log(`teams ingested: ${results.length}`);
  console.log(`snapshotCount: ${store?.snapshots.length ?? 0}`);
  console.log(`maxGameweek: ${meta.maxGameweek}`);
  if (incomplete.length) {
    console.log(
      `incomplete: ${incomplete.map((r) => r.team).join(", ")}`
    );
  }
  if (unknown.length) {
    console.log(`unknown kind: ${unknown.join(", ")}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
