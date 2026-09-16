import { NextRequest, NextResponse } from "next/server";
import { buildSnapshotFromRaw, ensureSeeded, upsertSnapshot } from "@/lib/store/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await ensureSeeded();
    const body = await req.json();
    const throughGameweek = Number(body.throughGameweek);
    if (!Number.isFinite(throughGameweek) || throughGameweek < 1 || throughGameweek > 38) {
      return NextResponse.json(
        { error: "throughGameweek must be between 1 and 38" },
        { status: 400 }
      );
    }

    let seasonStatsRaw = body.seasonStats ?? undefined;
    let expectedGoalsRaw = body.expectedGoals ?? undefined;

    if (typeof seasonStatsRaw === "string" && seasonStatsRaw.trim()) {
      seasonStatsRaw = JSON.parse(seasonStatsRaw);
    }
    if (typeof expectedGoalsRaw === "string" && expectedGoalsRaw.trim()) {
      expectedGoalsRaw = JSON.parse(expectedGoalsRaw);
    }

    if (!seasonStatsRaw && !expectedGoalsRaw) {
      return NextResponse.json(
        { error: "Provide SeasonStats and/or ExpectedGoals JSON" },
        { status: 400 }
      );
    }

    const snapshot = buildSnapshotFromRaw({
      throughGameweek,
      seasonStatsRaw,
      expectedGoalsRaw,
    });
    const store = await upsertSnapshot(snapshot);

    return NextResponse.json({
      ok: true,
      team: snapshot.teamName,
      throughGameweek: snapshot.throughGameweek,
      playerCount: snapshot.players.length,
      snapshotCount: store.snapshots.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingest failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
