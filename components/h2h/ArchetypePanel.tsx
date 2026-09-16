"use client";

import { formatNum } from "@/lib/utils";
import type { ArchetypeAnalysis } from "@/lib/h2h/metrics";
import { cn } from "@/lib/utils";

export function ArchetypePanel({
  analysis,
  shortA,
  shortB,
}: {
  analysis: ArchetypeAnalysis;
  shortA: string;
  shortB: string;
}) {
  const goalA = analysis.goalThreatTiltA;
  const chanceA = analysis.chanceTiltA;
  const chanceB = 100 - chanceA;

  return (
    <div className="flex h-full flex-col justify-between space-y-space-md">
      <div className="rounded-lg bg-surface-container-low p-space-md">
        <div className="flex items-center gap-space-xs text-[14px] font-semibold text-on-surface">
          <span>Tactical Archetype Arbitrage</span>
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-on-surface">
          <strong className="font-semibold">{analysis.title}.</strong> {analysis.body}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2">
        <TiltCard
          label="Goal Threat Tilt"
          headline={
            goalA >= 50
              ? `${goalA}% ${shortA}`
              : `${100 - goalA}% ${shortB}`
          }
          headlineClass={
            goalA >= 50 ? "text-on-tertiary-container" : "text-secondary"
          }
          detail={`${formatNum(analysis.xg90A)} vs ${formatNum(analysis.xg90B)} xG/90`}
          fillPct={goalA}
          fillFromLeft
          fillClass="bg-tertiary-fixed-dim"
        />
        <TiltCard
          label="Chance Creation Tilt"
          headline={
            chanceB >= chanceA
              ? `${chanceB}% ${shortB}`
              : `${chanceA}% ${shortA}`
          }
          headlineClass={
            chanceB >= chanceA ? "text-secondary" : "text-on-tertiary-container"
          }
          detail={`${formatNum(analysis.bcc90A)} vs ${formatNum(analysis.bcc90B)} BCC/90`}
          fillPct={Math.max(chanceA, chanceB)}
          fillFromLeft={chanceA >= chanceB}
          fillClass={chanceA >= chanceB ? "bg-tertiary-fixed-dim" : "bg-secondary"}
        />
      </div>

      <div className="flex flex-col items-start justify-between gap-2 rounded-lg bg-surface-container p-space-sm sm:flex-row sm:items-center">
        <div className="text-[12px] text-on-surface">
          Opta AI Recommendation:{" "}
          <strong>{analysis.recommendation}</strong>
        </div>
        <span className="font-data-mono text-[11px] text-on-surface-variant">
          Index Delta: +{formatNum(analysis.indexDelta, 1)}
        </span>
      </div>
    </div>
  );
}

function TiltCard({
  label,
  headline,
  headlineClass,
  detail,
  fillPct,
  fillFromLeft,
  fillClass,
}: {
  label: string;
  headline: string;
  headlineClass: string;
  detail: string;
  fillPct: number;
  fillFromLeft: boolean;
  fillClass: string;
}) {
  return (
    <div className="rounded-lg bg-surface-container-lowest p-space-sm shadow-sm">
      <span className="text-[10px] font-medium uppercase text-on-surface-variant">
        {label}
      </span>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className={cn("text-[14px] font-semibold", headlineClass)}>
          {headline}
        </span>
        <span className="font-data-mono text-[11px] text-on-surface-variant">
          {detail}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-container">
        <div
          className={cn("h-full", fillClass, !fillFromLeft && "ml-auto")}
          style={{ width: `${Math.max(8, Math.min(100, fillPct))}%` }}
        />
      </div>
    </div>
  );
}
