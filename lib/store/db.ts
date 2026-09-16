import { promises as fs } from "fs";
import path from "path";
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

const EMPTY_STORE: DataStore = { snapshots: [], seeded: false };

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function readStore(): Promise<DataStore> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(STORE_PATH, "utf-8");
    return JSON.parse(raw) as DataStore;
  } catch {
    return { ...EMPTY_STORE, snapshots: [] };
  }
}

export async function writeStore(store: DataStore): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export function buildSnapshotFromRaw(params: {
  throughGameweek: number;
  seasonStatsRaw?: unknown;
  expectedGoalsRaw?: unknown;
}): CumulativeSnapshot {
  const { throughGameweek, seasonStatsRaw, expectedGoalsRaw } = params;

  if (!seasonStatsRaw && !expectedGoalsRaw) {
    throw new Error("Provide SeasonStats and/or ExpectedGoals JSON");
  }

  const season = seasonStatsRaw ? parseSeasonStats(seasonStatsRaw) : null;
  const expected = expectedGoalsRaw ? parseExpectedGoals(expectedGoalsRaw) : null;

  const teamId = season?.team.id || expected?.team.id || "unknown";
  const teamName = season?.team.name || expected?.team.name || "Unknown";
  const shortName = season?.team.shortName || expected?.team.shortName || "UNK";

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
    teamId,
    teamName,
    shortName,
    seasonStatsRaw,
    expectedGoalsRaw,
    teamStats,
    players,
    uploadedAt: new Date().toISOString(),
  };
}

export async function upsertSnapshot(snapshot: CumulativeSnapshot): Promise<DataStore> {
  const store = await readStore();
  const idx = store.snapshots.findIndex(
    (s) => s.teamId === snapshot.teamId && s.throughGameweek === snapshot.throughGameweek
  );
  if (idx >= 0) {
    store.snapshots[idx] = snapshot;
  } else {
    store.snapshots.push(snapshot);
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

export async function ensureSeeded(): Promise<DataStore> {
  let store = await readStore();
  // seeded=true means "already initialized" (even if user cleared all snapshots)
  if (store.seeded) return store;

  try {
    const [seasonText, xgText] = await Promise.all([
      fs.readFile(SAMPLE_SEASON, "utf-8"),
      fs.readFile(SAMPLE_XG, "utf-8"),
    ]);
    const snapshot = buildSnapshotFromRaw({
      throughGameweek: 3,
      seasonStatsRaw: JSON.parse(seasonText),
      expectedGoalsRaw: JSON.parse(xgText),
    });
    store = await upsertSnapshot(snapshot);
    store.seeded = true;
    await writeStore(store);
  } catch (err) {
    console.error("Failed to seed Man City baseline:", err);
  }
  return store;
}
