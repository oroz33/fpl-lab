export type OptaKind = "seasonStats" | "expectedGoals" | "unknown";

export type ParsedBatchFile = {
  filename: string;
  kind: OptaKind;
  teamId: string;
  teamName: string;
  raw: unknown;
};

export type TeamIngestBundle = {
  teamId: string;
  teamName: string;
  seasonStats?: unknown;
  expectedGoals?: unknown;
  seasonFile?: string;
  xgFile?: string;
};

function firstStatEntry(raw: unknown): Record<string, unknown> | null {
  const data = raw as {
    contestant?: { stat?: Array<Record<string, unknown>> };
    player?: Array<{ stat?: Array<Record<string, unknown>> }>;
  };
  const teamStat = data.contestant?.stat?.[0];
  if (teamStat && typeof teamStat === "object") return teamStat;
  for (const p of data.player ?? []) {
    const s = p.stat?.[0];
    if (s && typeof s === "object") return s;
  }
  return null;
}

export function detectOptaKind(raw: unknown): OptaKind {
  const entry = firstStatEntry(raw);
  if (!entry) return "unknown";
  if ("name" in entry && entry.name !== undefined) return "seasonStats";
  if ("type" in entry && entry.type !== undefined) return "expectedGoals";
  return "unknown";
}

export function extractContestant(raw: unknown): { id: string; name: string } {
  const data = raw as {
    contestant?: {
      id?: string;
      name?: string;
      optaShortName?: string;
    };
  };
  const id = data.contestant?.id ?? `unknown-${Math.random().toString(36).slice(2, 9)}`;
  const name =
    data.contestant?.name ||
    data.contestant?.optaShortName ||
    "Unknown Team";
  return { id, name };
}

export function parseBatchFile(filename: string, text: string): ParsedBatchFile {
  const raw = JSON.parse(text) as unknown;
  const kind = detectOptaKind(raw);
  const { id, name } = extractContestant(raw);
  return { filename, kind, teamId: id, teamName: name, raw };
}

/** Pair SeasonStats + ExpectedGoals by contestant.id; unpaired files still form a bundle. */
export function pairBatchFiles(
  seasonFiles: ParsedBatchFile[],
  xgFiles: ParsedBatchFile[]
): TeamIngestBundle[] {
  const map = new Map<string, TeamIngestBundle>();

  for (const f of seasonFiles) {
    const existing = map.get(f.teamId) ?? {
      teamId: f.teamId,
      teamName: f.teamName,
    };
    existing.seasonStats = f.raw;
    existing.seasonFile = f.filename;
    existing.teamName = f.teamName || existing.teamName;
    map.set(f.teamId, existing);
  }

  for (const f of xgFiles) {
    const existing = map.get(f.teamId) ?? {
      teamId: f.teamId,
      teamName: f.teamName,
    };
    existing.expectedGoals = f.raw;
    existing.xgFile = f.filename;
    if (!existing.teamName || existing.teamName === "Unknown Team") {
      existing.teamName = f.teamName;
    }
    map.set(f.teamId, existing);
  }

  return [...map.values()].sort((a, b) => a.teamName.localeCompare(b.teamName));
}
