import type { GraphEntity } from "@/lib/graphs/axis-metrics";

export const GRAPH_CACHE_KEY = "fpl-lab:graphs:last";
export const GRAPH_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface GraphCacheEntry {
  id: string;
  createdAt: number;
  expiresAt: number;
  entity: GraphEntity;
  fromGw: number;
  toGw: number;
  xKey: string;
  yKey: string;
  xLabel: string;
  yLabel: string;
  title: string;
  imageDataUrl: string;
}

export function isCacheValid(entry: GraphCacheEntry | null, now = Date.now()): boolean {
  return !!entry && entry.expiresAt > now && !!entry.imageDataUrl;
}

export function readGraphCache(): GraphCacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(GRAPH_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GraphCacheEntry;
    if (!isCacheValid(parsed)) {
      localStorage.removeItem(GRAPH_CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(GRAPH_CACHE_KEY);
    return null;
  }
}

export function writeGraphCache(
  entry: Omit<GraphCacheEntry, "createdAt" | "expiresAt" | "id"> & { id?: string }
): GraphCacheEntry {
  const createdAt = Date.now();
  const full: GraphCacheEntry = {
    ...entry,
    id: entry.id ?? `graph-${createdAt}`,
    createdAt,
    expiresAt: createdAt + GRAPH_CACHE_TTL_MS,
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(GRAPH_CACHE_KEY, JSON.stringify(full));
  }
  return full;
}

export function clearGraphCache(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(GRAPH_CACHE_KEY);
}

export function msUntilExpiry(entry: GraphCacheEntry | null, now = Date.now()): number {
  if (!entry) return 0;
  return Math.max(0, entry.expiresAt - now);
}

export function formatRemaining(ms: number): string {
  if (ms <= 0) return "Expired";
  const mins = Math.ceil(ms / 60_000);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m left` : `${h}h left`;
  }
  return `${mins}m left`;
}
