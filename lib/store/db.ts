import { promises as fs } from "fs";
import path from "path";
import { BlobNotFoundError, get, put } from "@vercel/blob";
import { resolveTeamIdentity } from "@/lib/constants/teams";
import type { CumulativeSnapshot, DataStore } from "@/lib/types";
import { parseSeasonStats } from "@/lib/parsers/seasonStats";
import { parseExpectedGoals } from "@/lib/parsers/expectedGoals";
import {
  mergePlayerStats,
  mergeTeamStats,
  toCanonicalPlayerStats,
  toCanonicalTeamStats,
} from "@/lib/mapping/playerStats";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const SAMPLE_SEASON = path.join(DATA_DIR, "samples", "SeasonStats - Man City.json");
const SAMPLE_XG = path.join(DATA_DIR, "samples", "ExpectedGoals - Man City.json");
/** Fixed pathname in Vercel Blob (public Hobby store). */
const STORE_BLOB_PATH = "fpl-lab/store.json";

const EMPTY_STORE: DataStore = { snapshots: [], seeded: false };

/**
 * Local-dev only. On Vercel / Blob we always re-read the source of truth —
 * a process-local cache causes "ingest OK but /api/meta still shows old data"
 * across serverless instances.
 */
let memoryCache: DataStore | null = null;

export function isBlobStoreEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function getStorageMode(): "blob" | "filesystem" {
  return isBlobStoreEnabled() ? "blob" : "filesystem";
}

function isVercelRuntime(): boolean {
  return Boolean(process.env.VERCEL);
}

function assertPersistentWritesAllowed(): void {
  if (isVercelRuntime() && !isBlobStoreEnabled()) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is missing. Connect a Vercel Blob store to this project and redeploy — local filesystem writes do not persist on Vercel."
    );
  }
}

function cloneStore(store: DataStore): DataStore {
  return structuredClone(store);
}

function coerceThroughGameweek(value: unknown, fallback = 3): number {
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(n) && n >= 1 && n <= 38) return n;
  return fallback;
}

/**
 * Repair snapshots loaded from Blob/FS:
 * - restore missing/empty players from seasonStatsRaw / expectedGoalsRaw
 * - coerce invalid throughGameweek (null/0 → baseline 3)
 * - map Opta teamId → shortName via TEAM_ID_TO_CODE
 */
export function normalizeSnapshot(snapshot: CumulativeSnapshot): CumulativeSnapshot {
  const throughGameweek = coerceThroughGameweek(snapshot.throughGameweek, 3);
  const needsRebuild =
    !Array.isArray(snapshot.players) ||
    snapshot.players.length === 0 ||
    !snapshot.teamStats ||
    Object.keys(snapshot.teamStats).length === 0;

  let next: CumulativeSnapshot = snapshot;

  if (
    needsRebuild &&
    (snapshot.seasonStatsRaw != null || snapshot.expectedGoalsRaw != null)
  ) {
    try {
      const rebuilt = buildSnapshotFromRaw({
        throughGameweek,
        seasonStatsRaw: snapshot.seasonStatsRaw,
        expectedGoalsRaw: snapshot.expectedGoalsRaw,
      });
      next = {
        ...rebuilt,
        uploadedAt: snapshot.uploadedAt || rebuilt.uploadedAt,
      };
    } catch (err) {
      console.error("Failed to rebuild snapshot from raw JSON:", err);
    }
  }

  const identity = resolveTeamIdentity({
    teamId: next.teamId,
    name: next.teamName,
    shortName: next.shortName,
  });

  return {
    ...next,
    throughGameweek: coerceThroughGameweek(next.throughGameweek, throughGameweek),
    teamId: identity.teamId !== "unknown" ? identity.teamId : next.teamId,
    teamName: identity.name,
    shortName: identity.shortName,
    players: Array.isArray(next.players) ? next.players : [],
    teamStats: next.teamStats ?? {},
  };
}

export function normalizeStore(store: DataStore): DataStore {
  return {
    ...store,
    snapshots: (store.snapshots ?? []).map((s) => normalizeSnapshot(s)),
  };
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readStoreFromFs(): Promise<DataStore> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(STORE_PATH, "utf-8");
    return JSON.parse(raw) as DataStore;
  } catch {
    return { ...EMPTY_STORE, snapshots: [] };
  }
}

async function writeStoreToFs(store: DataStore): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

async function readStoreFromBlob(): Promise<DataStore> {
  try {
    const result = await get(STORE_BLOB_PATH, {
      access: "public",
      useCache: false,
    });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return { ...EMPTY_STORE, snapshots: [] };
    }
    const text = await new Response(result.stream).text();
    if (!text.trim()) return { ...EMPTY_STORE, snapshots: [] };
    return JSON.parse(text) as DataStore;
  } catch (err) {
    if (err instanceof BlobNotFoundError) {
      return { ...EMPTY_STORE, snapshots: [] };
    }
    const message = err instanceof Error ? err.message : "Blob read failed";
    throw new Error(`Failed to read store from Blob: ${message}`);
  }
}

async function writeStoreToBlob(store: DataStore): Promise<void> {
  await put(STORE_BLOB_PATH, JSON.stringify(store), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    multipart: true,
    cacheControlMaxAge: 0,
  });
}

export async function readStore(options?: { fresh?: boolean }): Promise<DataStore> {
  const fresh = options?.fresh || isBlobStoreEnabled();

  if (!fresh && memoryCache) {
    return cloneStore(memoryCache);
  }

  const raw = isBlobStoreEnabled()
    ? await readStoreFromBlob()
    : await readStoreFromFs();
  const store = normalizeStore(raw);

  if (!isBlobStoreEnabled()) {
    memoryCache = store;
  } else {
    memoryCache = null;
  }

  return cloneStore(store);
}

export async function writeStore(store: DataStore): Promise<void> {
  assertPersistentWritesAllowed();
  const normalized = normalizeStore(store);

  if (isBlobStoreEnabled()) {
    await writeStoreToBlob(normalized);
    memoryCache = null;
  } else {
    await writeStoreToFs(normalized);
    memoryCache = cloneStore(normalized);
  }
}

export function buildSnapshotFromRaw(params: {
  throughGameweek: number;
  seasonStatsRaw?: unknown;
  expectedGoalsRaw?: unknown;
}): CumulativeSnapshot {
  const throughGameweek = coerceThroughGameweek(params.throughGameweek, 3);
  const { seasonStatsRaw, expectedGoalsRaw } = params;

  if (!seasonStatsRaw && !expectedGoalsRaw) {
    throw new Error("Provide SeasonStats and/or ExpectedGoals JSON");
  }

  const season = seasonStatsRaw ? parseSeasonStats(seasonStatsRaw) : null;
  const expected = expectedGoalsRaw ? parseExpectedGoals(expectedGoalsRaw) : null;

  const identity = resolveTeamIdentity({
    teamId: season?.team.id || expected?.team.id,
    name: season?.team.name || expected?.team.name,
    shortName: season?.team.shortName || expected?.team.shortName,
  });

  const seasonPlayers = new Map((season?.players ?? []).map((p) => [p.id, p]));
  const expectedPlayers = new Map((expected?.players ?? []).map((p) => [p.id, p]));
  // SeasonStats defines the roster (after currentTeamOnly filtering). Do not
  // resurrect transferred players who only appear in ExpectedGoals for this club.
  const allIds = season
    ? new Set(seasonPlayers.keys())
    : new Set(expectedPlayers.keys());

  const players = [...allIds].map((id) => {
    const merged = mergePlayerStats(seasonPlayers.get(id), expectedPlayers.get(id));
    return {
      ...merged,
      stats: toCanonicalPlayerStats(merged),
    };
  });

  const teamStats = toCanonicalTeamStats(
    mergeTeamStats(season?.team.stats ?? {}, expected?.team.stats ?? {})
  );

  return {
    throughGameweek,
    teamId: identity.teamId,
    teamName: identity.name,
    shortName: identity.shortName,
    seasonStatsRaw,
    expectedGoalsRaw,
    teamStats,
    players,
    uploadedAt: new Date().toISOString(),
  };
}

export async function upsertSnapshot(snapshot: CumulativeSnapshot): Promise<DataStore> {
  const normalized = normalizeSnapshot(snapshot);
  const store = await readStore({ fresh: true });
  const idx = store.snapshots.findIndex(
    (s) =>
      s.teamId === normalized.teamId &&
      s.throughGameweek === normalized.throughGameweek
  );
  if (idx >= 0) {
    store.snapshots[idx] = normalized;
  } else {
    store.snapshots.push(normalized);
  }
  store.snapshots.sort(
    (a, b) => a.teamId.localeCompare(b.teamId) || a.throughGameweek - b.throughGameweek
  );
  await writeStore(store);
  return store;
}

export async function clearStore(): Promise<DataStore> {
  const store: DataStore = { snapshots: [], seeded: true };
  await writeStore(store);
  return store;
}

/** Seed Man City GW1–3 sample into the active store (FS or Blob). */
export async function seedManCityBaseline(): Promise<DataStore> {
  const [seasonText, xgText] = await Promise.all([
    fs.readFile(SAMPLE_SEASON, "utf-8"),
    fs.readFile(SAMPLE_XG, "utf-8"),
  ]);
  const snapshot = buildSnapshotFromRaw({
    throughGameweek: 3,
    seasonStatsRaw: JSON.parse(seasonText),
    expectedGoalsRaw: JSON.parse(xgText),
  });
  const store = await upsertSnapshot(snapshot);
  store.seeded = true;
  await writeStore(store);
  return store;
}

export async function ensureSeeded(): Promise<DataStore> {
  let store = await readStore({ fresh: true });
  // seeded=true means "already initialized" (even if user cleared all snapshots)
  if (store.seeded) return store;

  try {
    store = await seedManCityBaseline();
  } catch (err) {
    console.error("Failed to seed Man City baseline:", err);
  }
  return store;
}
