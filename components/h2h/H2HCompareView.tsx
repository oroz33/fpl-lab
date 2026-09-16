"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import type { MetaResponse, PlayerRow, StatsResponse } from "@/lib/types";
import {
  buildArchetype,
  findDefaultPair,
  initialsFromName,
  positionLabel,
  type StatMode,
} from "@/lib/h2h/metrics";
import { PlayerSlotPicker } from "@/components/h2h/PlayerSlotPicker";
import { H2HSpotlightCard } from "@/components/h2h/H2HSpotlightCard";
import { PercentileRadar } from "@/components/h2h/PercentileRadar";
import { ArchetypePanel } from "@/components/h2h/ArchetypePanel";
import { H2HMatrix } from "@/components/h2h/H2HMatrix";
import { cn } from "@/lib/utils";
import packageJson from "@/package.json";

export function H2HCompareView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramA = searchParams.get("a");
  const paramB = searchParams.get("b");

  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [fromGw, setFromGw] = useState(1);
  const [toGw, setToGw] = useState(3);
  const [mode, setMode] = useState<StatMode>("per90");
  const [playerAId, setPlayerAId] = useState<string | null>(paramA);
  const [playerBId, setPlayerBId] = useState<string | null>(paramB);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [defaultsApplied, setDefaultsApplied] = useState(false);

  const syncUrl = useCallback(
    (a: string | null, b: string | null) => {
      const params = new URLSearchParams();
      if (a) params.set("a", a);
      if (b) params.set("b", b);
      const qs = params.toString();
      router.replace(qs ? `/h2h?${qs}` : "/h2h", { scroll: false });
    },
    [router]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/meta");
        if (!res.ok) throw new Error("Failed to load meta");
        const data = (await res.json()) as MetaResponse;
        if (cancelled) return;
        setMeta(data);
        setToGw(data.maxGameweek || 3);
        setFromGw(1);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load meta");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!meta) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          from: String(fromGw),
          to: String(toGw),
          position: "All",
        });
        const res = await fetch(`/api/stats?${params}`);
        if (!res.ok) throw new Error("Failed to load stats");
        const data = (await res.json()) as StatsResponse;
        if (cancelled) return;
        setPlayers(data.players);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load stats");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [meta, fromGw, toGw]);

  useEffect(() => {
    if (!players.length || defaultsApplied) return;
    const outfield = players.filter((p) => p.position !== "GKP");
    const byId = (id: string | null) => {
      if (!id) return null;
      const found = outfield.find((p) => p.id === id) ?? null;
      return found;
    };

    let nextA = byId(paramA ?? playerAId);
    let nextB = byId(paramB ?? playerBId);

    if (!nextA && !nextB) {
      const [dA, dB] = findDefaultPair(outfield);
      nextA = dA;
      nextB = dB;
    } else if (nextA && !nextB) {
      const [alt] = findDefaultPair(outfield.filter((p) => p.id !== nextA!.id));
      nextB = alt && alt.id !== nextA.id ? alt : null;
      if (!nextB) {
        nextB = outfield.find((p) => p.id !== nextA!.id && p.mins > 0) ?? null;
      }
    }

    setPlayerAId(nextA?.id ?? null);
    setPlayerBId(nextB?.id ?? null);
    setDefaultsApplied(true);
    if (nextA || nextB) syncUrl(nextA?.id ?? null, nextB?.id ?? null);
  }, [players, defaultsApplied, paramA, paramB, playerAId, playerBId, syncUrl]);

  const outfieldPlayers = useMemo(
    () => players.filter((p) => p.position !== "GKP"),
    [players]
  );

  const playerA = useMemo(
    () => outfieldPlayers.find((p) => p.id === playerAId) ?? null,
    [outfieldPlayers, playerAId]
  );
  const playerB = useMemo(
    () => outfieldPlayers.find((p) => p.id === playerBId) ?? null,
    [outfieldPlayers, playerBId]
  );

  const analysis = useMemo(
    () => (playerA && playerB ? buildArchetype(playerA, playerB) : null),
    [playerA, playerB]
  );

  const baselineLabel = playerA
    ? `Baseline: ${positionLabel(playerA.position)}`
    : "Baseline: Position peers";

  const selectA = (p: PlayerRow) => {
    setPlayerAId(p.id);
    syncUrl(p.id, playerBId);
  };
  const selectB = (p: PlayerRow) => {
    setPlayerBId(p.id);
    syncUrl(playerAId, p.id);
  };

  const maxGw = meta?.maxGameweek ?? 3;

  return (
    <div className="flex w-full flex-col">
      <div className="flex w-full flex-col justify-between gap-space-md bg-surface-container-lowest px-space-xl py-space-md shadow-[0_1px_4px_rgba(0,0,0,0.02)] md:flex-row md:items-center">
        <div className="flex flex-col">
          <h1 className="text-[20px] font-bold tracking-tight text-on-surface">
            H2H Player Comparison
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-space-sm">
          <button
            type="button"
            className="inline-flex items-center gap-space-xs rounded bg-surface-container px-space-md py-space-xs text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {baselineLabel}
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1680px] space-y-space-lg p-space-xl">
        {error ? (
          <div className="rounded-lg bg-error-container px-space-md py-space-sm text-[13px] text-on-error-container">
            {error}
          </div>
        ) : null}

        <div className="flex flex-col items-center justify-between gap-space-md rounded-xl bg-surface-container-lowest p-space-md shadow-[0_1px_6px_rgba(0,0,0,0.03)] xl:flex-row">
          <PlayerSlotPicker
            slot="a"
            player={playerA}
            players={outfieldPlayers}
            accent="emerald"
            excludeId={playerBId}
            onSelect={selectA}
          />
          <div className="flex shrink-0 items-center justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-[10px] font-bold tracking-wider text-on-primary shadow-md">
              VS
            </div>
          </div>
          <PlayerSlotPicker
            slot="b"
            player={playerB}
            players={outfieldPlayers}
            accent="secondary"
            excludeId={playerAId}
            onSelect={selectB}
          />
          <div className="flex shrink-0 items-center gap-space-sm">
            <div className="flex items-center overflow-hidden rounded bg-surface-container p-0.5">
              <button
                type="button"
                onClick={() => setMode("per90")}
                className={cn(
                  "px-space-md py-1 text-[10px] font-bold uppercase transition-colors",
                  mode === "per90"
                    ? "bg-primary text-on-primary shadow-sm"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                )}
              >
                Per 90
              </button>
              <button
                type="button"
                onClick={() => setMode("total")}
                className={cn(
                  "px-space-md py-1 text-[10px] font-bold uppercase transition-colors",
                  mode === "total"
                    ? "bg-primary text-on-primary shadow-sm"
                    : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                )}
              >
                Total
              </button>
            </div>
            <div className="flex items-center gap-space-xs rounded bg-surface-container px-space-md py-1 font-data-mono text-[11px] text-on-surface">
              <label className="flex items-center gap-1">
                <span className="text-on-surface-variant">GW</span>
                <select
                  className="bg-transparent outline-none"
                  value={fromGw}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setFromGw(next);
                    setToGw((t) => Math.max(next, t));
                  }}
                >
                  {Array.from({ length: maxGw }, (_, i) => i + 1).map((gw) => (
                    <option key={gw} value={gw}>
                      {gw}
                    </option>
                  ))}
                </select>
              </label>
              <span className="text-on-surface-variant">–</span>
              <select
                className="bg-transparent outline-none"
                value={toGw}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setToGw(next);
                  setFromGw((f) => Math.min(f, next));
                }}
              >
                {Array.from({ length: maxGw }, (_, i) => i + 1).map((gw) => (
                  <option key={gw} value={gw}>
                    {gw}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {loading && !playerA ? (
          <div className="rounded-xl bg-surface-container-lowest p-space-xl text-center text-[13px] text-on-surface-variant">
            Loading Opta comparison window…
          </div>
        ) : null}

        {playerA && playerB ? (
          <>
            <div className="grid grid-cols-1 gap-space-lg lg:grid-cols-2">
              <H2HSpotlightCard player={playerA} accent="emerald" />
              <H2HSpotlightCard player={playerB} accent="secondary" />
            </div>

            <div className="grid grid-cols-1 items-center gap-space-xl rounded-xl bg-surface-container-lowest p-space-xl shadow-[0_1px_6px_rgba(0,0,0,0.03)] xl:grid-cols-12">
              <div className="xl:col-span-5">
                <PercentileRadar
                  playerA={playerA}
                  playerB={playerB}
                  allPlayers={players}
                  mode={mode}
                />
              </div>
              <div className="xl:col-span-7">
                {analysis ? (
                  <ArchetypePanel
                    analysis={analysis}
                    shortA={initialsFromName(playerA.name)}
                    shortB={initialsFromName(playerB.name)}
                  />
                ) : null}
              </div>
            </div>

            <H2HMatrix playerA={playerA} playerB={playerB} mode={mode} />
          </>
        ) : !loading ? (
          <div className="rounded-xl bg-surface-container-lowest p-space-xl text-center text-[13px] text-on-surface-variant">
            Select two players to begin the head-to-head comparison.
          </div>
        ) : null}

        <div className="flex flex-col items-center justify-between gap-2 rounded-lg bg-surface-container-lowest p-space-md font-data-mono text-[11px] text-on-surface-variant shadow-sm md:flex-row">
          <div className="flex flex-wrap items-center gap-space-sm">
            <span className="flex items-center gap-1 text-on-surface">
              <span className="h-2 w-2 rounded-full bg-tertiary-fixed" /> Feed Pipeline: Ready
            </span>
            <span>•</span>
            <span>Local Opta Bridge v{packageJson.version}</span>
            <span>•</span>
            <span>H2H Quant Core</span>
          </div>
          <div>
            Window GW{fromGw}–GW{toGw}
            {meta?.snapshotCount != null ? ` • ${meta.snapshotCount} snapshots` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
