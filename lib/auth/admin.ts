import { NextRequest, NextResponse } from "next/server";

/** True when write APIs require ADMIN_SECRET (production). */
export function isWriteProtected(): boolean {
  return Boolean(process.env.ADMIN_SECRET);
}

/**
 * When ADMIN_SECRET is set, require Bearer token or x-admin-secret header.
 * When unset (local dev), allow all writes.
 * Returns a 401 response if unauthorized; otherwise null.
 */
export function assertAdmin(req: NextRequest): NextResponse | null {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return null;

  const auth = req.headers.get("authorization");
  const bearer =
    auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : null;
  const headerSecret = req.headers.get("x-admin-secret")?.trim() ?? null;

  if (bearer === secret || headerSecret === secret) return null;

  return NextResponse.json({ error: "Unauthorized — admin secret required" }, { status: 401 });
}
