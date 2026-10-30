import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { assertAdmin } from "@/lib/auth/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type TeamEntry = {
  name: string;
  ctst: string;
};

type TeamsConfig = {
  tmcl: string;
  api_url_patterns: {
    seasonstats: string;
    seasonexpectedgoals: string;
  };
  teams: TeamEntry[];
};

type FeedKey = "seasonexpectedgoals" | "seasonstats";

const FEEDS: { key: FeedKey; folder: string }[] = [
  { key: "seasonexpectedgoals", folder: "EXPECTED GOALS" },
  { key: "seasonstats", folder: "SEASONSTATS" },
];

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-GB,en;q=0.9",
  Referer: "https://www.scoresway.com/",
  Origin: "https://www.scoresway.com",
};

const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]+/g;

function sanitizeFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(INVALID_FILENAME_CHARS, "_")
    .replace(/\s+/g, " ")
    .replace(/^[ ._]+|[ ._]+$/g, "");
  return cleaned || "unknown";
}

function buildUrl(pattern: string, tmcl: string, ctst: string): string {
  return pattern.replaceAll("{tmcl}", tmcl).replaceAll("{ctst}", ctst);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readConfig(): Promise<TeamsConfig> {
  const configPath = path.join(process.cwd(), "teams_config.json");
  const raw = await fs.readFile(configPath, "utf-8");
  const data = JSON.parse(raw) as TeamsConfig;
  if (!data?.tmcl || !data.api_url_patterns || !Array.isArray(data.teams)) {
    throw new Error("teams_config.json is missing tmcl, patterns, or teams");
  }
  return data;
}

async function downloadFeed(
  url: string,
  dest: string,
  ctst: string
): Promise<{ bytes: number; contestant: string }> {
  const response = await fetch(url, { headers: FETCH_HEADERS, cache: "no-store" });
  const text = await response.text();
  let data: {
    errorCode?: string | number;
    contestant?: { id?: string; name?: string };
  };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    throw new Error(`non-JSON HTTP ${response.status}`);
  }
  if (data?.errorCode) {
    throw new Error(`errorCode=${data.errorCode} HTTP ${response.status}`);
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const contestantId = data.contestant?.id;
  if (contestantId && contestantId !== ctst) {
    throw new Error(`contestant id ${contestantId} != ${ctst}`);
  }
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, text, "utf-8");
  return {
    bytes: Buffer.byteLength(text),
    contestant: data.contestant?.name ?? ctst,
  };
}

export async function POST(req: NextRequest) {
  // vercel env pull sets VERCEL=1 locally with an empty VERCEL_URL.
  // The platform itself always provides VERCEL_URL, and that disk is not this PC.
  if (process.env.VERCEL && process.env.VERCEL_URL) {
    return NextResponse.json(
      {
        error:
          "Feed download writes to the local data folder and only runs on this machine.",
      },
      { status: 400 }
    );
  }

  const denied = assertAdmin(req);
  if (denied) return denied;

  let gameweek = NaN;
  try {
    const body = (await req.json()) as { gameweek?: unknown };
    gameweek = Number(body.gameweek);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!Number.isInteger(gameweek) || gameweek < 1 || gameweek > 38) {
    return NextResponse.json(
      { error: "gameweek must be an integer from 1 to 38" },
      { status: 400 }
    );
  }

  let config: TeamsConfig;
  try {
    config = await readConfig();
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    const message = err instanceof Error ? err.message : "Failed to read teams_config.json";
    return NextResponse.json(
      { error: message },
      { status: code === "ENOENT" ? 404 : 500 }
    );
  }

  const destRoot = path.join(process.cwd(), "data", `GameWeek${gameweek}`);
  const jobs = FEEDS.flatMap((feed) =>
    config.teams.map((team) => ({ feed, team }))
  );
  const total = jobs.length;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      let saved = 0;
      const failed: string[] = [];
      let stopped = false;

      send({ type: "start", total, gameweek, dir: destRoot });

      try {
        for (let i = 0; i < jobs.length; i++) {
          const { feed, team } = jobs[i];
          const pattern = config.api_url_patterns[feed.key];
          const url = buildUrl(pattern, config.tmcl, team.ctst);
          const filename = `${feed.key} - ${sanitizeFilename(team.name)}.json`;
          const dest = path.join(destRoot, feed.folder, filename);
          try {
            const result = await downloadFeed(url, dest, team.ctst);
            saved += 1;
            send({
              type: "file",
              index: i + 1,
              total,
              feed: feed.key,
              folder: feed.folder,
              team: team.name,
              ok: true,
              bytes: result.bytes,
              contestant: result.contestant,
              file: filename,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : "Download failed";
            const label = `${team.name} (${feed.key}): ${message}`;
            failed.push(label);
            stopped = true;
            send({
              type: "file",
              index: i + 1,
              total,
              feed: feed.key,
              folder: feed.folder,
              team: team.name,
              ok: false,
              error: message,
            });
            break;
          }
          if (i < jobs.length - 1) {
            await sleep(250);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Download failed";
        failed.push(message);
        stopped = true;
      }

      send({
        type: "done",
        ok: saved,
        failed,
        stopped,
        total,
        gameweek,
        dir: destRoot,
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
