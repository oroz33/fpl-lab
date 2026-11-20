"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Loader2,
  RefreshCcw,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { useAppShell } from "@/components/layout/AppShell";
import { GameweekRange } from "@/components/filters/GameweekRange";
import { PositionFilter } from "@/components/filters/PositionFilter";
import {
  ScatterChart,
  type ScatterChartHandle,
} from "@/components/graphs/ScatterChart";
import { Button } from "@/components/ui/button";
import {
  axisMetricsFor,
  defaultAxisKeys,
  findAxisMetric,
  type GraphEntity,
} from "@/lib/graphs/axis-metrics";
import {
  clearGraphCache,
  formatRemaining,
  isCacheValid,
  msUntilExpiry,
  readGraphCache,
  writeGraphCache,
  type GraphCacheEntry,
} from "@/lib/graphs/chart-cache";
import { downloadGraphPdf } from "@/lib/graphs/export-pdf";
import {
  numericValue,
  selectOutlierIds,
  type ScatterPoint,
} from "@/lib/graphs/outliers";
import type { MetaResponse, Position, StatsResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const MIN_GENERATE_MS = 500;

export function GraphsView() {
  const { registerIngestHandler } = useAppShell();
  const chartRef = useRef<ScatterChartHandle>(null);

  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [fromGw, setFromGw] = useState(1);
  const [toGw, setToGw] = useState(3);
  const [position, setPosition] = useState<Position | "All">("All");
  const [entity, setEntity] = useState<GraphEntity>("players");
  const [xKey, setXKey] = useState("xG");
  const [yKey, setYKey] = useState("goals");

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartPoints, setChartPoints] = useState<ScatterPoint[] | null>(null);
  const [labeledIds, setLabeledIds] = useState<Set<string>>(new Set());
  const [activeMeta, setActiveMeta] = useState<{
    entity: GraphEntity;
    fromGw: number;
    toGw: number;
    xKey: string;
    yKey: string;
    xLabel: string;
    yLabel: string;
    xDescription: string;
    yDescription: string;
  } | null>(null);
  const [cache, setCache] = useState<GraphCacheEntry | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [awaitingSnapshot, setAwaitingSnapshot] = useState(false);

  const metrics = useMemo(() => axisMetricsFor(entity), [entity]);
  const xMetric = findAxisMetric(entity, xKey) ?? metrics[0]!;
  const yMetric = findAxisMetric(entity, yKey) ?? metrics[1] ?? metrics[0]!;
  const maxGw = meta?.maxGameweek ?? 3;
  const cacheValid = isCacheValid(cache, nowTick);
  const remainingLabel = formatRemaining(msUntilExpiry(cache, nowTick));

  useEffect(() => {
    const cached = readGraphCache();
    if (cached) {
      setCache(cached);
      setPreviewImage(cached.imageDataUrl);
      setEntity(cached.entity);
      setFromGw(cached.fromGw);
      setToGw(cached.toGw);
      setXKey(cached.xKey);
      setYKey(cached.yKey);
      setActiveMeta({
        entity: cached.entity,
        fromGw: cached.fromGw,
        toGw: cached.toGw,
        xKey: cached.xKey,
        yKey: cached.yKey,
        xLabel: cached.xLabel,
        yLabel: cached.yLabel,
        xDescription:
          findAxisMetric(cached.entity, cached.xKey)?.description ?? cached.xLabel,
        yDescription:
          findAxisMetric(cached.entity, cached.yKey)?.description ?? cached.yLabel,
      });
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (cache && !isCacheValid(cache, nowTick)) {
      clearGraphCache();
      setCache(null);
      // Keep an interactive on-screen chart; only the downloadable snapshot expires.
      if (!chartPoints) setPreviewImage(null);
    }
  }, [cache, nowTick, chartPoints]);

  const loadMeta = useCallback(async () => {
    const res = await fetch("/api/meta");
    const data = (await res.json()) as MetaResponse;
    setMeta(data);
    setToGw((prev) => Math.min(Math.max(prev, data.maxGameweek), data.maxGameweek));
  }, []);

  useEffect(() => {
    loadMeta().catch(() => undefined);
  }, [loadMeta]);

  useEffect(() => {
    registerIngestHandler(() => {
      loadMeta().catch(() => undefined);
    });
    return () => registerIngestHandler(null);
  }, [registerIngestHandler, loadMeta]);

  const onEntityChange = (next: GraphEntity) => {
    setEntity(next);
    const defaults = defaultAxisKeys(next);
    setXKey(defaults.xKey);
    setYKey(defaults.yKey);
  };

  const pendingCacheMeta = useRef<NonNullable<typeof activeMeta> | null>(null);

  const captureAndCache = useCallback((metaInfo: NonNullable<typeof activeMeta>) => {
    const imageDataUrl = chartRef.current?.getImageDataUrl();
    if (!imageDataUrl) return;
    const entry = writeGraphCache({
      entity: metaInfo.entity,
      fromGw: metaInfo.fromGw,
      toGw: metaInfo.toGw,
      xKey: metaInfo.xKey,
      yKey: metaInfo.yKey,
      xLabel: metaInfo.xLabel,
      yLabel: metaInfo.yLabel,
      title: `${metaInfo.yLabel} vs ${metaInfo.xLabel}`,
      imageDataUrl,
    });
    setCache(entry);
    setPreviewImage(imageDataUrl);
    setNowTick(Date.now());
    pendingCacheMeta.current = null;
    setAwaitingSnapshot(false);
  }, []);

  const handleChartReady = useCallback(() => {
    if (pendingCacheMeta.current) {
      // One frame so labels/markLines finish painting
      requestAnimationFrame(() => {
        if (pendingCacheMeta.current) captureAndCache(pendingCacheMeta.current);
      });
    }
  }, [captureAndCache]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    const started = Date.now();

    try {
      const params = new URLSearchParams({
        from: String(fromGw),
        to: String(toGw),
        position: entity === "players" ? position : "All",
        q: "",
      });
      const res = await fetch(`/api/stats?${params}`);
      if (!res.ok) throw new Error("Failed to load stats");
      const data = (await res.json()) as StatsResponse;

      const rows =
        entity === "players"
          ? (data.players as unknown as Record<string, unknown>[])
          : (data.teams as unknown as Record<string, unknown>[]);

      const points: ScatterPoint[] = [];
      for (const row of rows) {
        const x = numericValue(row, xMetric.key);
        const y = numericValue(row, yMetric.key);
        if (x == null || y == null) continue;
        points.push({
          id: String(row.id),
          name: String(row.name ?? ""),
          team:
            entity === "players"
              ? String(row.teamShort ?? row.team ?? "")
              : undefined,
          x,
          y,
        });
      }

      if (points.length === 0) {
        throw new Error("No points to plot for the selected metrics and filters.");
      }

      const labels = selectOutlierIds(points, entity);
      const nextMeta = {
        entity,
        fromGw,
        toGw,
        xKey: xMetric.key,
        yKey: yMetric.key,
        xLabel: xMetric.label,
        yLabel: yMetric.label,
        xDescription: xMetric.description,
        yDescription: yMetric.description,
      };

      const elapsed = Date.now() - started;
      if (elapsed < MIN_GENERATE_MS) {
        await new Promise((r) => setTimeout(r, MIN_GENERATE_MS - elapsed));
      }

      pendingCacheMeta.current = nextMeta;
      setAwaitingSnapshot(true);
      setChartPoints(points);
      setLabeledIds(labels);
      setActiveMeta(nextMeta);
      setPreviewImage(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate chart");
      setChartPoints(null);
      pendingCacheMeta.current = null;
      setAwaitingSnapshot(false);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPdf = () => {
    const live = chartRef.current?.getImageDataUrl();
    const entry =
      cacheValid && cache
        ? live
          ? { ...cache, imageDataUrl: live }
          : cache
        : null;
    if (!entry || !isCacheValid(entry)) {
      setError("Chart expired. Generate again to download.");
      clearGraphCache();
      setCache(null);
      return;
    }
    downloadGraphPdf(entry);
  };

  const handleResetZoom = () => {
    chartRef.current?.resetZoom();
  };

  const showLiveChart = chartPoints != null && activeMeta != null;
  const showExpiredPreview = !showLiveChart && previewImage && cacheValid;

  return (
    <div className="mx-auto w-full max-w-[1720px] space-y-space-md p-3 md:px-space-xl md:py-space-lg">
      <div className="space-y-space-md rounded-xl bg-surface-container-lowest p-3 shadow-[0_2px_12px_rgba(11,28,48,0.04)] md:p-space-lg">
        <div className="flex flex-col gap-space-md lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-[18px] font-bold text-on-surface">Graphs</h1>
            <p className="mt-1 max-w-xl text-[13px] text-on-surface-variant">
              Pick two metrics, generate a scatter plot, zoom into dense areas,
              and download a PDF while the chart remains available locally for
              one hour.
            </p>
          </div>

          <div className="inline-flex gap-1 self-start rounded-xl bg-surface-container-low p-1 shadow-sm">
            <button
              type="button"
              onClick={() => onEntityChange("players")}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-lg px-space-xl py-1.5 text-[14px] font-semibold transition-all md:min-h-0",
                entity === "players"
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              )}
            >
              <Users className="h-4 w-4" />
              Players
            </button>
            <button
              type="button"
              onClick={() => onEntityChange("teams")}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-lg px-space-xl py-1.5 text-[14px] font-semibold transition-all md:min-h-0",
                entity === "teams"
                  ? "bg-primary text-on-primary shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              )}
            >
              <Shield className="h-4 w-4" />
              Teams
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-space-md border-t border-border-interior pt-space-md">
          <div className="flex flex-wrap items-center gap-space-md">
            <GameweekRange
              from={fromGw}
              to={toGw}
              max={Math.max(maxGw, 3)}
              onChange={(f, t) => {
                setFromGw(f);
                setToGw(t);
              }}
            />
            {entity === "players" && (
              <PositionFilter value={position} onChange={setPosition} />
            )}
          </div>

          <div className="grid gap-space-md md:grid-cols-2">
            <AxisSelect
              axis="X"
              value={xKey}
              metrics={metrics}
              onChange={setXKey}
              description={xMetric.description}
            />
            <AxisSelect
              axis="Y"
              value={yKey}
              metrics={metrics}
              onChange={setYKey}
              description={yMetric.description}
            />
          </div>

          <div className="flex flex-wrap items-center gap-space-sm">
            <Button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={generating || xKey === yKey}
              className="min-w-[140px]"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Building chart…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={handleResetZoom}
              disabled={!showLiveChart}
            >
              <RefreshCcw className="h-4 w-4" />
              Reset Zoom
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadPdf}
              disabled={!cacheValid}
            >
              <Download className="h-4 w-4" />
              Download PDF
            </Button>

            {cacheValid && (
              <span className="font-data-mono text-[11px] text-on-surface-variant">
                Download available · {remainingLabel}
              </span>
            )}
            {!cacheValid && !showLiveChart && !showExpiredPreview && (
              <span className="text-[12px] text-on-surface-variant">
                Generate a chart to enable PDF download (1 hour).
              </span>
            )}
            {!cacheValid &&
              !generating &&
              !awaitingSnapshot &&
              (showLiveChart || previewImage) && (
              <span className="text-[12px] text-amber-700">
                Download expired — generate again to export PDF.
              </span>
            )}
          </div>

          {xKey === yKey && (
            <p className="text-[12px] text-error">
              Choose different metrics for X and Y.
            </p>
          )}
          {error && <p className="text-[13px] text-error">{error}</p>}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-[0_2px_12px_rgba(11,28,48,0.04)]">
        {activeMeta && (
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-interior px-space-lg py-space-md">
            <div>
              <div className="text-[15px] font-bold text-on-surface">
                {activeMeta.yLabel} vs {activeMeta.xLabel}
              </div>
              <div className="mt-0.5 text-[12px] text-on-surface-variant">
                {activeMeta.entity === "players" ? "Players" : "Teams"} · GW{" "}
                {activeMeta.fromGw}–{activeMeta.toGw}
                {showLiveChart && chartPoints
                  ? ` · ${chartPoints.length} points`
                  : ""}
              </div>
            </div>
            <div className="max-w-md text-right text-[11px] text-on-surface-variant">
              <div>
                <span className="font-semibold text-on-surface">X</span> —{" "}
                {activeMeta.xDescription}
              </div>
              <div>
                <span className="font-semibold text-on-surface">Y</span> —{" "}
                {activeMeta.yDescription}
              </div>
            </div>
          </div>
        )}

        <div className="relative min-h-[480px] p-space-sm md:p-space-md">
          {generating && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-container-lowest/80 backdrop-blur-[1px]">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-on-surface">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Building chart…
              </div>
            </div>
          )}

          {showLiveChart && activeMeta && (
            <div className="h-[min(70vh,640px)] w-full">
              <ScatterChart
                ref={chartRef}
                points={chartPoints}
                labeledIds={labeledIds}
                xLabel={activeMeta.xLabel}
                yLabel={activeMeta.yLabel}
                entity={activeMeta.entity}
                onReady={handleChartReady}
              />
            </div>
          )}

          {showExpiredPreview && previewImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewImage}
              alt="Cached scatter chart"
              className="mx-auto max-h-[640px] w-full object-contain"
            />
          )}

          {!showLiveChart && !showExpiredPreview && !generating && (
            <div className="flex h-[420px] flex-col items-center justify-center gap-2 text-center text-on-surface-variant">
              <Sparkles className="h-8 w-8 opacity-40" />
              <p className="text-[14px] font-semibold text-on-surface">
                No chart yet
              </p>
              <p className="max-w-sm text-[13px]">
                Select X and Y metrics, then press Generate to build a scatter
                plot from your uploaded Opta data.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AxisSelect({
  axis,
  value,
  metrics,
  onChange,
  description,
}: {
  axis: "X" | "Y";
  value: string;
  metrics: ReturnType<typeof axisMetricsFor>;
  onChange: (key: string) => void;
  description: string;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, typeof metrics>();
    for (const m of metrics) {
      const list = map.get(m.group) ?? [];
      list.push(m);
      map.set(m.group, list);
    }
    return Array.from(map.entries());
  }, [metrics]);

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
        {axis}-axis
      </span>
      <select
        className="h-10 rounded-lg border border-border-boundary bg-surface-container-lowest px-3 text-[13px] font-semibold text-on-surface outline-none focus:ring-2 focus:ring-primary/30"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {groups.map(([group, items]) => (
          <optgroup key={group} label={group}>
            {items.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label} — {m.description}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <span className="text-[12px] text-on-surface-variant">{description}</span>
    </label>
  );
}
