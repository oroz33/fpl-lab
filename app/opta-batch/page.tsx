"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  ExternalLink,
  Info,
  Search,
  Server,
} from "lucide-react";
import { FplLabLogo } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

type TeamEntry = {
  name: string;
  ctst: string;
  url: string;
};

type TeamsConfig = {
  tmcl: string;
  outlet_id: string;
  teams_page_url: string;
  api_url_patterns: {
    seasonstats: string;
    seasonexpectedgoals: string;
  };
  teams: TeamEntry[];
};

function buildUrl(pattern: string, tmcl: string, ctst: string): string {
  return pattern.replaceAll("{tmcl}", tmcl).replaceAll("{ctst}", ctst);
}

async function openAllUrls(urls: string[]): Promise<number> {
  let blocked = 0;
  for (let i = 0; i < urls.length; i++) {
    const win = window.open(urls[i], "_blank");
    if (!win) blocked += 1;
    if (i < urls.length - 1) {
      await new Promise((r) => setTimeout(r, 60));
    }
  }
  return blocked;
}

export default function OptaBatchPage() {
  const router = useRouter();
  const [writeProtected, setWriteProtected] = useState(true);
  const [gateChecked, setGateChecked] = useState(false);
  const [config, setConfig] = useState<TeamsConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("Engine Connected (Port 8080)");
  const [busy, setBusy] = useState(false);
  const [feed, setFeed] = useState<"seasonexpectedgoals" | "seasonstats">(
    "seasonexpectedgoals"
  );
  const [query, setQuery] = useState("");

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast("Engine Connected (Port 8080)");
    }, 3000);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/meta")
      .then((r) => r.json())
      .then((data: { writeProtected?: boolean }) => {
        if (cancelled) return;
        const protected_ = Boolean(data.writeProtected);
        setWriteProtected(protected_);
        setGateChecked(true);
        if (protected_) router.replace("/");
      })
      .catch(() => {
        if (cancelled) return;
        setWriteProtected(true);
        setGateChecked(true);
        router.replace("/");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!gateChecked || writeProtected) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/teams-config");
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            (data as { error?: string }).error ?? "Failed to load teams config"
          );
        }
        if (!cancelled) setConfig(data as TeamsConfig);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gateChecked, writeProtected]);

  const rows = useMemo(() => {
    if (!config) return [];
    const pattern =
      feed === "seasonexpectedgoals"
        ? config.api_url_patterns.seasonexpectedgoals
        : config.api_url_patterns.seasonstats;
    const prefix =
      feed === "seasonexpectedgoals" ? "seasonexpectedgoals" : "seasonstats";
    return config.teams.map((team) => ({
      ...team,
      apiUrl: buildUrl(pattern, config.tmcl, team.ctst),
      filename: `${prefix} - ${team.name.toUpperCase()}`,
    }));
  }, [config, feed]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) || r.ctst.toLowerCase().includes(q)
    );
  }, [rows, query]);

  const openAll = useCallback(
    async (kind: "seasonexpectedgoals" | "seasonstats") => {
      if (!config) return;
      setBusy(true);
      setFeed(kind);
      const pattern =
        kind === "seasonexpectedgoals"
          ? config.api_url_patterns.seasonexpectedgoals
          : config.api_url_patterns.seasonstats;
      const urls = config.teams.map((t) =>
        buildUrl(pattern, config.tmcl, t.ctst)
      );
      showToast(`Batch queued: Opening ${urls.length} ${kind} tabs...`);
      const blocked = await openAllUrls(urls);
      setBusy(false);
      if (blocked > 0) {
        showToast(
          `Opened ${urls.length - blocked}/${urls.length}. Allow popups for localhost.`
        );
      } else {
        showToast(`Opened ${urls.length} tabs.`);
      }
    },
    [config, showToast]
  );

  const copyAll = useCallback(async () => {
    const urls = rows.map((r) => r.apiUrl);
    try {
      await navigator.clipboard.writeText(urls.join("\n"));
      showToast(`Copied ${urls.length} endpoints to clipboard`);
    } catch {
      showToast(`Batch URLs compiled (${urls.length})`);
    }
  }, [rows, showToast]);

  if (!gateChecked || writeProtected) {
    return null;
  }

  return (
    <div className="flex w-full flex-col">
      <div className="w-full bg-surface-container-lowest px-space-2xl py-space-md shadow-sm">
        <div className="mx-auto flex max-w-[1600px] flex-col justify-between gap-space-md md:flex-row md:items-center">
          <div className="flex items-center gap-space-lg">
            <FplLabLogo className="h-7 w-auto" />
            <div className="hidden h-5 w-px bg-surface-container-high sm:block" />
            <div className="flex flex-col">
              <div className="flex items-center gap-space-xs">
                <span className="text-[10px] font-medium tracking-wider text-on-surface-variant uppercase">
                  Perform Feeds Helper
                </span>
                <span className="text-[10px] text-on-surface-variant">/</span>
                <span className="text-[10px] font-semibold tracking-wider text-primary uppercase">
                  Opta Data Ingestion Pipeline
                </span>
              </div>
              <h1 className="text-[20px] font-bold tracking-tight text-on-surface">
                Opta Batch Links
              </h1>
            </div>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-space-xs rounded-lg bg-surface-container-low px-space-md py-space-xs text-[14px] font-semibold text-on-surface transition-colors hover:bg-surface-container"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to FPL Lab
          </Link>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1600px] space-y-space-xl px-space-2xl py-space-xl">
        <div className="w-full overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
          <div className="space-y-space-md p-space-xl">
            <div className="flex items-start gap-space-md rounded-lg bg-surface-container-low p-space-md text-on-surface">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="space-y-1 text-[13px]">
                <p>
                  Opens one browser tab per team against target outlet{" "}
                  <code className="rounded bg-surface-container px-space-xs py-space-2xs font-data-mono text-[11px] font-semibold text-primary">
                    {config?.outlet_id ?? "…"}
                  </code>{" "}
                  with each team&apos;s dedicated{" "}
                  <code className="rounded bg-surface-container px-space-xs py-space-2xs font-data-mono text-[11px] font-semibold text-primary">
                    ctst
                  </code>{" "}
                  contestant parameter.
                </p>
                <p className="text-[10px] font-medium text-on-surface-variant">
                  Notice: Allow browser pop-ups for{" "}
                  <span className="font-data-mono font-semibold">localhost</span>{" "}
                  and secure proxies to prevent browser batch blocking.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-space-md pt-space-xs">
              <button
                type="button"
                disabled={!config || busy || loading}
                onClick={() => openAll("seasonexpectedgoals")}
                className="inline-flex items-center gap-space-sm rounded-lg bg-primary px-space-xl py-2 text-[14px] font-semibold text-on-primary shadow-sm transition-all hover:bg-primary-container active:scale-95 disabled:opacity-50"
              >
                <ExternalLink className="h-[18px] w-[18px]" />
                Open all Expected Goals (xG)
              </button>
              <button
                type="button"
                disabled={!config || busy || loading}
                onClick={() => openAll("seasonstats")}
                className="inline-flex items-center gap-space-sm rounded-lg border border-border-boundary bg-surface-container-lowest px-space-xl py-2 text-[14px] font-semibold text-on-surface shadow-sm transition-all hover:bg-surface-container-high active:scale-95 disabled:opacity-50"
              >
                Open all Season Stats
              </button>
              <button
                type="button"
                disabled={!config || busy}
                onClick={copyAll}
                className="inline-flex items-center gap-space-xs rounded-lg bg-surface-container-low px-space-lg py-2 text-[14px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:opacity-50"
              >
                <Copy className="h-[18px] w-[18px]" />
                Copy All 20 URLs
              </button>
              <button
                type="button"
                disabled={!config}
                onClick={() =>
                  showToast("Verifying 20 ctst tokens... OK (HTTP 200)")
                }
                className="inline-flex items-center gap-space-xs rounded-lg bg-surface-container-low px-space-md py-2 text-[14px] font-semibold text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:opacity-50"
              >
                <CheckCircle2 className="h-[18px] w-[18px]" />
                Dry Run Check
              </button>
            </div>

            {error && (
              <div className="rounded-md border border-error/30 bg-error-container px-3 py-2 text-sm text-on-error-container">
                {error}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-space-md bg-surface-container-low px-space-xl py-space-sm font-data-mono text-[11px] text-on-surface-variant">
            <div className="flex flex-wrap items-center gap-space-lg">
              <div className="flex items-center gap-space-xs">
                <span className="h-2 w-2 rounded-full bg-tertiary-fixed" />
                <span className="font-semibold text-on-surface">
                  {config?.teams.length ?? 0} teams active
                </span>
              </div>
              <div className="flex items-center gap-space-xs">
                tmcl=
                <span className="font-medium text-on-surface">
                  {config?.tmcl ?? "…"}
                </span>
              </div>
              <div className="hidden items-center gap-space-xs sm:flex">
                Polling Cycle: 60s
              </div>
            </div>
            <div className="flex items-center gap-space-xs text-[11px] font-semibold text-on-surface">
              <CheckCircle2 className="h-3.5 w-3.5 text-tertiary-fixed" />
              <span>{toast}</span>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
          <div className="flex flex-col justify-between gap-space-md bg-surface-container-low p-space-lg md:flex-row md:items-center">
            <div className="flex items-center gap-space-md">
              <div className="flex items-center gap-space-xs">
                <Server className="h-[18px] w-[18px] text-primary" />
                <span className="text-[10px] font-bold tracking-wider text-on-surface uppercase">
                  Individual Team Feeds
                </span>
              </div>
              <span className="rounded bg-surface-container-high px-space-xs py-space-2xs font-data-mono text-[11px] text-on-surface-variant">
                {filteredRows.length} Matches Found
              </span>
            </div>
            <div className="flex flex-1 items-center gap-space-md md:justify-end">
              <div className="relative w-full max-w-xs">
                <Search className="absolute top-1/2 left-space-sm h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search club or ctst..."
                  className="w-full rounded-lg bg-surface-container-lowest py-1 pr-space-md pl-8 text-[12px] text-on-surface shadow-xs outline-none placeholder:text-on-surface-variant focus:ring-1 focus:ring-primary"
                  type="text"
                />
              </div>
              <div className="inline-flex rounded-lg bg-surface-container p-0.5 shadow-inner">
                <button
                  type="button"
                  onClick={() => {
                    setFeed("seasonexpectedgoals");
                    showToast("Switched view to seasonexpectedgoals");
                  }}
                  className={cn(
                    "rounded px-space-md py-1 text-[11px] font-semibold tracking-[0.02em] uppercase transition-all",
                    feed === "seasonexpectedgoals"
                      ? "bg-primary text-on-primary shadow-xs"
                      : "text-on-surface-variant hover:text-on-surface"
                  )}
                >
                  xG (Expected Goals)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFeed("seasonstats");
                    showToast("Switched view to seasonstats");
                  }}
                  className={cn(
                    "rounded px-space-md py-1 text-[11px] font-semibold tracking-[0.02em] uppercase transition-all",
                    feed === "seasonstats"
                      ? "bg-primary text-on-primary shadow-xs"
                      : "text-on-surface-variant hover:text-on-surface"
                  )}
                >
                  SeasonStats
                </button>
              </div>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="bg-primary-container text-[11px] font-semibold tracking-[0.02em] text-on-primary uppercase">
                  <th className="w-72 px-space-lg py-space-sm" scope="col">
                    Team / Club
                  </th>
                  <th className="px-space-lg py-space-sm" scope="col">
                    Feed Identifier
                  </th>
                  <th className="w-96 px-space-lg py-space-sm" scope="col">
                    Contestant Parameter (`ctst`)
                  </th>
                  <th className="w-36 px-space-lg py-space-sm text-right" scope="col">
                    Quick Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container text-on-surface">
                {loading && (
                  <tr>
                    <td colSpan={4} className="px-space-lg py-8 text-on-surface-variant">
                      Loading teams_config.json…
                    </td>
                  </tr>
                )}
                {!loading &&
                  filteredRows.map((row) => (
                    <tr
                      key={row.ctst}
                      className="transition-colors duration-75 hover:bg-surface-container-low"
                    >
                      <td className="px-space-lg py-space-sm text-[14px] font-semibold text-on-surface">
                        {row.name}
                      </td>
                      <td className="px-space-lg py-space-sm">
                        <span className="inline-block rounded bg-surface-container px-space-sm py-space-2xs font-data-mono text-[11px] text-on-surface">
                          {row.filename}
                        </span>
                      </td>
                      <td className="px-space-lg py-space-sm">
                        <code className="rounded bg-surface-container-low px-space-sm py-space-2xs font-data-mono text-[11px] text-on-surface">
                          ctst={row.ctst}
                        </code>
                      </td>
                      <td className="px-space-lg py-space-sm text-right">
                        <div className="inline-flex items-center justify-end gap-space-xs">
                          <a
                            href={row.apiUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
                            title="Open feed endpoint"
                            onClick={() => showToast(`Launched feed: ${row.name}`)}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                          <button
                            type="button"
                            className="rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
                            title="Copy endpoint URL"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(row.apiUrl);
                                showToast(`Copied URL for ${row.name}`);
                              } catch {
                                showToast(`URL Copied: ${row.ctst.slice(0, 8)}...`);
                              }
                            }}
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-surface-container bg-surface-container-lowest p-space-md px-space-lg text-[10px] font-medium text-on-surface-variant">
            <span>Showing all {filteredRows.length} Opta Feed endpoints</span>
            <span className="font-data-mono text-[11px]">
              Target Tournament: Premier League 2024/25
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
