import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/auth/admin";
import { seedManCityBaseline } from "@/lib/store/db";

export const dynamic = "force-dynamic";

/** Re-seed Man City GW1–3 baseline from sample files into FS / Vercel Blob. */
export async function POST(req: NextRequest) {
  const denied = assertAdmin(req);
  if (denied) return denied;

  try {
    const snapshot = await seedManCityBaseline();
    const manCity = snapshot.snapshots.find((s) => s.shortName === "MCI") ?? snapshot.snapshots[0];
    return NextResponse.json({
      ok: true,
      team: manCity?.teamName ?? "Manchester City",
      throughGameweek: manCity?.throughGameweek ?? 3,
      playerCount: manCity?.players.length ?? 0,
      storageMode: process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "filesystem",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Seed failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
