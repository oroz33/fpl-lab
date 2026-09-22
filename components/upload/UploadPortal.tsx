"use client";

import { useEffect, useState } from "react";
import { CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  pairBatchFiles,
  parseBatchFile,
  type ParsedBatchFile,
} from "@/lib/ingest/batch";

const ADMIN_SECRET_KEY = "fpl-lab-admin-secret";

async function readFilesAsBatch(fileList: FileList | null): Promise<{
  ok: ParsedBatchFile[];
  errors: string[];
}> {
  if (!fileList || fileList.length === 0) return { ok: [], errors: [] };
  const ok: ParsedBatchFile[] = [];
  const errors: string[] = [];
  for (const file of Array.from(fileList)) {
    try {
      const text = await file.text();
      ok.push(parseBatchFile(file.name, text));
    } catch (err) {
      errors.push(
        `${file.name}: ${err instanceof Error ? err.message : "parse failed"}`
      );
    }
  }
  return { ok, errors };
}

function summarizeFiles(files: ParsedBatchFile[]): string {
  if (files.length === 0) return "";
  const names = files.slice(0, 4).map((f) => f.filename);
  const more = files.length > 4 ? ` +${files.length - 4} more` : "";
  return `${files.length} file${files.length === 1 ? "" : "s"}: ${names.join(", ")}${more}`;
}

function adminHeaders(secret: string, writeProtected: boolean): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (writeProtected && secret.trim()) {
    headers.Authorization = `Bearer ${secret.trim()}`;
    headers["x-admin-secret"] = secret.trim();
  }
  return headers;
}

export function UploadPortal({ onIngested }: { onIngested: () => void }) {
  const [open, setOpen] = useState(false);
  const [throughGw, setThroughGw] = useState(3);
  const [seasonText, setSeasonText] = useState("");
  const [xgText, setXgText] = useState("");
  const [seasonBatch, setSeasonBatch] = useState<ParsedBatchFile[]>([]);
  const [xgBatch, setXgBatch] = useState<ParsedBatchFile[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [writeProtected, setWriteProtected] = useState(false);
  const [adminSecret, setAdminSecret] = useState("");
  const [storageMode, setStorageMode] = useState<"blob" | "filesystem" | null>(
    null
  );

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(ADMIN_SECRET_KEY);
      if (saved) setAdminSecret(saved);
    } catch {
      /* ignore */
    }
    fetch("/api/meta")
      .then((r) => r.json())
      .then(
        (data: {
          writeProtected?: boolean;
          storageMode?: "blob" | "filesystem";
        }) => {
          setWriteProtected(Boolean(data.writeProtected));
          if (data.storageMode === "blob" || data.storageMode === "filesystem") {
            setStorageMode(data.storageMode);
          }
        }
      )
      .catch(() => {
        /* meta optional for local */
      });
  }, []);

  function persistSecret(value: string) {
    setAdminSecret(value);
    try {
      if (value.trim()) sessionStorage.setItem(ADMIN_SECRET_KEY, value.trim());
      else sessionStorage.removeItem(ADMIN_SECRET_KEY);
    } catch {
      /* ignore */
    }
  }

  async function ingestOne(payload: {
    throughGameweek: number;
    seasonStats?: unknown;
    expectedGoals?: unknown;
  }) {
    const res = await fetch("/api/ingest", {
      method: "POST",
      headers: adminHeaders(adminSecret, writeProtected),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    return data as { team: string; throughGameweek: number; playerCount: number };
  }

  async function handleSeasonFiles(fileList: FileList | null) {
    const { ok, errors } = await readFilesAsBatch(fileList);
    const seasons = ok.filter((f) => f.kind !== "expectedGoals");
    const xgs = ok.filter((f) => f.kind === "expectedGoals");
    setSeasonBatch(seasons);
    if (xgs.length) {
      setXgBatch((prev) => {
        const byId = new Map(prev.map((p) => [p.teamId, p]));
        for (const f of xgs) byId.set(f.teamId, f);
        return [...byId.values()];
      });
    }
    if (seasons.length === 1) {
      setSeasonText(JSON.stringify(seasons[0].raw, null, 2));
    } else {
      setSeasonText("");
    }
    if (errors.length) {
      setStatus(`Some files failed:\n${errors.join("\n")}`);
    }
  }

  async function handleXgFiles(fileList: FileList | null) {
    const { ok, errors } = await readFilesAsBatch(fileList);
    const xgs = ok.filter((f) => f.kind !== "seasonStats");
    const seasons = ok.filter((f) => f.kind === "seasonStats");
    setXgBatch(xgs);
    if (seasons.length) {
      setSeasonBatch((prev) => {
        const byId = new Map(prev.map((p) => [p.teamId, p]));
        for (const f of seasons) byId.set(f.teamId, f);
        return [...byId.values()];
      });
    }
    if (xgs.length === 1) {
      setXgText(JSON.stringify(xgs[0].raw, null, 2));
    } else {
      setXgText("");
    }
    if (errors.length) {
      setStatus(`Some files failed:\n${errors.join("\n")}`);
    }
  }

  async function ingest() {
    if (writeProtected && !adminSecret.trim()) {
      setStatus("Admin secret required for uploads in production.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const useBatch = seasonBatch.length > 0 || xgBatch.length > 0;

      if (useBatch) {
        const bundles = pairBatchFiles(seasonBatch, xgBatch);
        if (bundles.length === 0) {
          throw new Error("No valid team JSON files to ingest");
        }

        const okNames: string[] = [];
        const failLines: string[] = [];

        for (let i = 0; i < bundles.length; i++) {
          const b = bundles[i];
          setStatus(`Ingesting ${i + 1}/${bundles.length}: ${b.teamName}…`);
          try {
            const data = await ingestOne({
              throughGameweek: throughGw,
              seasonStats: b.seasonStats,
              expectedGoals: b.expectedGoals,
            });
            okNames.push(`${data.team} (${data.playerCount})`);
          } catch (err) {
            failLines.push(
              `${b.teamName}: ${err instanceof Error ? err.message : "failed"}`
            );
          }
        }

        onIngested();
        const summary = [
          `Ingested ${okNames.length}/${bundles.length} teams through GW${throughGw}.`,
          okNames.length ? `OK: ${okNames.join("; ")}` : "",
          failLines.length ? `Failed: ${failLines.join("; ")}` : "",
        ]
          .filter(Boolean)
          .join("\n");
        setStatus(summary);
        if (failLines.length === 0) {
          setTimeout(() => setOpen(false), 900);
        }
        return;
      }

      // Single-team paste path
      const data = await ingestOne({
        throughGameweek: throughGw,
        seasonStats: seasonText.trim() || undefined,
        expectedGoals: xgText.trim() || undefined,
      });
      setStatus(
        `Ingested ${data.team} through GW${data.throughGameweek} (${data.playerCount} players).`
      );
      onIngested();
      setTimeout(() => setOpen(false), 800);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function clearAllData() {
    if (writeProtected && !adminSecret.trim()) {
      setStatus("Admin secret required to clear data in production.");
      return;
    }
    const confirmed = window.confirm(
      "Clear ALL uploaded snapshots? You can upload fresh JSON afterwards. This cannot be undone."
    );
    if (!confirmed) return;

    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/clear", {
        method: "POST",
        headers: adminHeaders(adminSecret, writeProtected),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Clear failed");
      setSeasonBatch([]);
      setXgBatch([]);
      setSeasonText("");
      setXgText("");
      setStatus("All data cleared. You can upload JSON files now.");
      onIngested();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Clear failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadSample() {
    if (writeProtected && !adminSecret.trim()) {
      setStatus("Admin secret required to seed data in production.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/seed", {
        method: "POST",
        headers: adminHeaders(adminSecret, writeProtected),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Seed failed");
      setStatus(`Loaded Man City baseline GW1–3 (${data.playerCount} players).`);
      onIngested();
      setTimeout(() => setOpen(false), 800);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Seed failed");
    } finally {
      setBusy(false);
    }
  }

  const batchCount = pairBatchFiles(seasonBatch, xgBatch).length;
  const writesLocked = writeProtected && !adminSecret.trim();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="gap-space-xs px-space-lg"
        >
          <CloudUpload className="h-4 w-4" />
          Upload Opta Feed
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Weekly data ingest</DialogTitle>
          <DialogDescription>
            Upload one team via paste, or multi-select many SeasonStats /
            ExpectedGoals JSON files. Files are paired by team id and ingested
            with the same through-gameweek.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {writeProtected && storageMode === "filesystem" && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              Server storage is filesystem mode — uploads will not persist on
              Vercel. Connect a Blob store (`BLOB_READ_WRITE_TOKEN`) and redeploy.
            </p>
          )}

          {writeProtected && (
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Admin secret
              </span>
              <Input
                type="password"
                autoComplete="current-password"
                placeholder="Required for upload / clear / seed"
                value={adminSecret}
                onChange={(e) => persistSecret(e.target.value)}
              />
              <p className="text-xs text-slate-500">
                Matches the ADMIN_SECRET env var on the server. Stored in this
                browser tab only.
              </p>
            </label>
          )}

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Cumulative through gameweek
            </span>
            <Input
              type="number"
              min={1}
              max={38}
              value={throughGw}
              onChange={(e) => setThroughGw(Number(e.target.value))}
            />
          </label>

          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              SeasonStats JSON (multi-select)
            </span>
            <Input
              type="file"
              accept=".json,.txt,.csv"
              multiple
              onChange={(e) => handleSeasonFiles(e.target.files)}
            />
            {seasonBatch.length > 0 && (
              <p className="text-xs text-slate-500">{summarizeFiles(seasonBatch)}</p>
            )}
            <Textarea
              placeholder="Or paste a single SeasonStats JSON…"
              value={seasonText}
              onChange={(e) => {
                setSeasonText(e.target.value);
                if (e.target.value.trim()) setSeasonBatch([]);
              }}
              className="min-h-[90px]"
            />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              ExpectedGoals JSON (multi-select)
            </span>
            <Input
              type="file"
              accept=".json,.txt,.csv"
              multiple
              onChange={(e) => handleXgFiles(e.target.files)}
            />
            {xgBatch.length > 0 && (
              <p className="text-xs text-slate-500">{summarizeFiles(xgBatch)}</p>
            )}
            <Textarea
              placeholder="Or paste a single ExpectedGoals JSON…"
              value={xgText}
              onChange={(e) => {
                setXgText(e.target.value);
                if (e.target.value.trim()) setXgBatch([]);
              }}
              className="min-h-[90px]"
            />
          </div>

          {batchCount > 0 && (
            <p className="text-xs font-medium text-[#0b3a5b]">
              Ready to ingest {batchCount} team{batchCount === 1 ? "" : "s"} through
              GW{throughGw}
            </p>
          )}

          {status && (
            <p className="whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {status}
            </p>
          )}

          <div className="flex flex-wrap gap-2 justify-between">
            <Button
              variant="danger"
              onClick={clearAllData}
              disabled={busy || writesLocked}
              type="button"
            >
              Clear all data
            </Button>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button
                variant="outline"
                onClick={loadSample}
                disabled={busy || writesLocked}
              >
                Load Man City GW1–3
              </Button>
              <Button onClick={ingest} disabled={busy || writesLocked}>
                {busy
                  ? "Ingesting…"
                  : batchCount > 1
                    ? `Ingest ${batchCount} teams`
                    : "Ingest & refresh"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
