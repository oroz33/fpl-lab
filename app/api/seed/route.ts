import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { buildSnapshotFromRaw, upsertSnapshot, writeStore, readStore } from "@/lib/store/db";

export const dynamic = "force-dynamic";

/** Re-seed Man City GW1–3 baseline from sample files (POC helper). */
export async function POST() {
  try {
    const dataDir = path.join(process.cwd(), "data", "samples");
    const [seasonText, xgText] = await Promise.all([
      fs.readFile(path.join(dataDir, "SeasonStats - Man City.json"), "utf-8"),
      fs.readFile(path.join(dataDir, "ExpectedGoals - Man City.json"), "utf-8"),
    ]);
    const snapshot = buildSnapshotFromRaw({
      throughGameweek: 3,
      seasonStatsRaw: JSON.parse(seasonText),
      expectedGoalsRaw: JSON.parse(xgText),
    });
    await upsertSnapshot(snapshot);
    const store = await readStore();
    store.seeded = true;
    await writeStore(store);
    return NextResponse.json({
      ok: true,
      team: snapshot.teamName,
      throughGameweek: 3,
      playerCount: snapshot.players.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Seed failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
