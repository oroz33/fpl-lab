/**
 * Replace production Vercel Blob store with local data/store.json.
 *
 * Usage: npm run sync:prod
 *
 * Auth (first match wins):
 * 1. BLOB_READ_WRITE_TOKEN in .env.local / env
 * 2. Vercel CLI session (`vercel blob put` against the linked project)
 */
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { put } from "@vercel/blob";
import { normalizeStore } from "../lib/store/db.ts";
import type { DataStore } from "../lib/types.ts";

const STORE_BLOB_PATH = "fpl-lab/store.json";
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
      // Always prefer file values when non-empty (vercel pull may leave empties).
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

function summarize(store: DataStore, sizeBytes: number) {
  const gws = new Map<number, number>();
  const teams = new Set<string>();
  for (const s of store.snapshots) {
    gws.set(s.throughGameweek, (gws.get(s.throughGameweek) ?? 0) + 1);
    teams.add(s.shortName || s.teamId);
  }
  console.log(`  snapshots: ${store.snapshots.length}`);
  console.log(`  teams:     ${teams.size}`);
  console.log(
    `  by GW:     ${[...gws.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([gw, n]) => `GW${gw}×${n}`)
      .join(", ")}`
  );
  console.log(`  size:      ${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`);
}

await loadEnvFile(path.join(root, ".env.local"));
await loadEnvFile(path.join(root, ".env"));

const storePath = path.join(root, "data", "store.json");
let rawText: string;
try {
  rawText = await fs.readFile(storePath, "utf8");
} catch {
  console.error(`Local store not found: ${storePath}`);
  process.exit(1);
}

const parsed = JSON.parse(rawText) as DataStore;
const store = normalizeStore(parsed);
const body = JSON.stringify(store);
const sizeBytes = Buffer.byteLength(body, "utf8");

console.log(`Uploading ${storePath} → Blob ${STORE_BLOB_PATH}`);
summarize(store, sizeBytes);

const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();

if (token) {
  const result = await put(STORE_BLOB_PATH, body, {
    access: "public",
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    multipart: true,
    cacheControlMaxAge: 0,
  });
  console.log(`Done via @vercel/blob. url=${result.url}`);
} else {
  console.log(
    "BLOB_READ_WRITE_TOKEN missing/empty — falling back to `vercel blob put` (CLI login)."
  );
  const tmpPath = path.join(root, "data", ".store.sync.tmp.json");
  await fs.writeFile(tmpPath, body, "utf8");
  try {
    const result = spawnSync(
      "npx",
      [
        "--yes",
        "vercel",
        "blob",
        "put",
        tmpPath,
        "--pathname",
        STORE_BLOB_PATH,
        "--force",
        "true",
        "--multipart",
        "true",
        "--content-type",
        "application/json",
        "--cache-control-max-age",
        "0",
      ],
      { cwd: root, encoding: "utf8", shell: true }
    );
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.status !== 0) {
      console.error(
        "vercel blob put failed. Run `npx vercel login` and `npx vercel link --project fpl-lab`, then retry."
      );
      process.exit(result.status ?? 1);
    }
    console.log("Done via vercel CLI blob put.");
  } finally {
    await fs.unlink(tmpPath).catch(() => undefined);
  }
}

console.log("Verify: https://fpl-lab-alpha.vercel.app/api/meta");
