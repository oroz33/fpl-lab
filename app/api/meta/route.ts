import { NextResponse } from "next/server";
import { isWriteProtected } from "@/lib/auth/admin";
import { ensureSeeded, getStorageMode } from "@/lib/store/db";
import { getMetaFromSnapshots } from "@/lib/delta/engine";
import type { MetaResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await ensureSeeded();
  const meta = getMetaFromSnapshots(store.snapshots);
  const body: MetaResponse = {
    maxGameweek: meta.maxGameweek,
    minGameweek: meta.minGameweek,
    teams: meta.teams,
    snapshotCount: store.snapshots.length,
    seeded: store.seeded,
    writeProtected: isWriteProtected(),
    storageMode: getStorageMode(),
  };
  return NextResponse.json(body);
}
