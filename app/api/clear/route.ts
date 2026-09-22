import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/auth/admin";
import { clearStore } from "@/lib/store/db";

export const dynamic = "force-dynamic";

/** Wipe all snapshots so the user can re-upload from scratch. Does not re-seed samples. */
export async function POST(req: NextRequest) {
  const denied = assertAdmin(req);
  if (denied) return denied;

  try {
    const store = await clearStore();
    return NextResponse.json({
      ok: true,
      snapshotCount: store.snapshots.length,
      message: "All data cleared",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Clear failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
