import { NextResponse } from "next/server";
import { ensureSeeded } from "@/lib/store/db";
import { loadTournamentSchedule } from "@/lib/fdr/engine";
import { buildFixtureMatrix } from "@/lib/fdr/matrix";
import type { FixtureTrackerResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await ensureSeeded();
  const schedule = await loadTournamentSchedule();
  const body: FixtureTrackerResponse = buildFixtureMatrix(store.snapshots, schedule);
  return NextResponse.json(body);
}
