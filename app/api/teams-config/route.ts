import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  const configPath = path.join(process.cwd(), "teams_config.json");
  try {
    const raw = await fs.readFile(configPath, "utf-8");
    const data = JSON.parse(raw) as unknown;
    return NextResponse.json(data);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return NextResponse.json(
        {
          error:
            "teams_config.json not found. Run scripts/scrape_pl_teams.py once to generate it.",
        },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read teams_config.json" },
      { status: 500 }
    );
  }
}
