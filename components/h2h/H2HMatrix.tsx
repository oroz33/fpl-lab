"use client";

import { useMemo, Fragment } from "react";
import type { PlayerRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  MATRIX_CATEGORIES,
  compareMetric,
  formatMetricValue,
  initialsFromName,
  shortName,
  type StatMode,
} from "@/lib/h2h/metrics";

export function H2HMatrix({
  playerA,
  playerB,
  mode,
}: {
  playerA: PlayerRow;
  playerB: PlayerRow;
  mode: StatMode;
}) {
  const { cells, winsA, winsB, ties } = useMemo(() => {
    let a = 0;
    let b = 0;
    let t = 0;
    const cells = MATRIX_CATEGORIES.map((cat) => ({
      cat,
      metrics: cat.metrics.map((metric) => {
        const va = metric.get(playerA, mode);
        const vb = metric.get(playerB, mode);
        const winner = compareMetric(va, vb, metric.lowerIsBetter);
        if (winner === "a") a += 1;
        else if (winner === "b") b += 1;
        else if (winner === "tie") t += 1;
        return { metric, va, vb, winner };
      }),
    }));
    return { cells, winsA: a, winsB: b, ties: t };
  }, [playerA, playerB, mode]);

  const labelA = shortName(playerA.name);
  const labelB = shortName(playerB.name);
  const metricModeLabel = mode === "per90" ? "METRIC (PER 90)" : "METRIC (TOTAL)";

  return (
    <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-[0_1px_6px_rgba(0,0,0,0.03)]">
      <div className="flex flex-wrap items-center justify-between gap-2 px-space-lg py-space-sm">
        <div className="text-[14px] font-semibold text-on-surface">
          Full Forensic Statistical Head-to-Head
        </div>
        <div className="flex items-center gap-space-md font-data-mono text-[10px] text-on-surface-variant">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-tertiary-fixed" />
            Metric Leader Highlighted
          </span>
          <span>
            Sample: {playerA.mins} / {playerB.mins} mins
          </span>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="h-9 bg-primary tracking-wider text-on-primary uppercase">
              <th className="w-5/12 px-space-xl py-space-xs text-right text-[14px] font-semibold">
                <span className="inline-flex items-center justify-end gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-tertiary-fixed" />
                  {labelA} ({playerA.teamShort})
                </span>
              </th>
              <th className="w-2/12 px-space-lg py-space-xs text-center text-[11px] font-semibold text-surface-container">
                {metricModeLabel}
              </th>
              <th className="w-5/12 px-space-xl py-space-xs text-left text-[14px] font-semibold">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-secondary-fixed" />
                  {labelB} ({playerB.teamShort})
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container-low">
            {cells.map(({ cat, metrics }) => (
              <Fragment key={`cat-${cat.id}`}>
                <tr className="bg-surface-container-low text-on-surface">
                  <td
                    colSpan={3}
                    className="px-space-xl py-1 text-center text-[10px] font-bold tracking-widest text-on-surface-variant uppercase"
                  >
                    {cat.title}
                  </td>
                </tr>
                {metrics.map(({ metric, va, vb, winner }) => (
                  <tr
                    key={`${cat.id}-${metric.key}`}
                    className="h-9 transition-colors hover:bg-surface-container-low/50"
                  >
                    <td
                      className={cn(
                        "px-space-xl py-cell-py text-right font-data-mono text-[12px]",
                        winner === "a"
                          ? "bg-tertiary-fixed/20 font-bold text-on-tertiary-container"
                          : "text-on-surface-variant",
                        winner === "tie" && "font-semibold text-on-surface"
                      )}
                    >
                      {formatMetricValue(va, metric)}
                      {winner === "tie" ? (
                        <span className="ml-1 text-[10px] font-medium uppercase text-on-surface-variant">
                          Tied
                        </span>
                      ) : null}
                    </td>
                    <td className="px-space-lg py-cell-py text-center text-[12px] font-semibold text-on-surface-variant">
                      {metric.label}
                    </td>
                    <td
                      className={cn(
                        "px-space-xl py-cell-py text-left font-data-mono text-[12px]",
                        winner === "b"
                          ? "bg-secondary-fixed/30 font-bold text-secondary"
                          : "text-on-surface-variant",
                        winner === "tie" && "font-semibold text-on-surface"
                      )}
                    >
                      {formatMetricValue(vb, metric)}
                      {winner === "tie" ? (
                        <span className="ml-1 text-[10px] font-medium uppercase text-on-surface-variant">
                          Tied
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-center justify-between gap-2 bg-surface-container-low px-space-xl py-space-sm text-[10px] text-on-surface-variant sm:flex-row">
        <span>
          Metric thresholds derived from Opta cumulative deltas.{" "}
          {mode === "per90"
            ? "Values normalised to 90 mins."
            : "Totals for selected GW window."}
        </span>
        <div className="font-data-mono text-[11px]">
          Wins:{" "}
          <strong className="text-on-tertiary-container">
            {initialsFromName(playerA.name)}: {winsA}
          </strong>{" "}
          •{" "}
          <strong className="text-secondary">
            {initialsFromName(playerB.name)}: {winsB}
          </strong>{" "}
          • Tied: {ties}
        </div>
      </div>
    </div>
  );
}
