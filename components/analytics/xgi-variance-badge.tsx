"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, round } from "@/lib/utils";
import type { RegressionStatus } from "@/lib/types";

const STATUS_LABEL: Record<RegressionStatus, string> = {
  UNDERPERFORMING: "Underperformance — High Unrealized Potential",
  OVERPERFORMING: "Overperformance Risk",
  ALIGNED: "Aligned with Expectation",
};

function formatSignedVariance(value: number): string {
  if (Object.is(value, -0) || value === 0) return "0.00";
  const abs = Math.abs(value).toFixed(2);
  return value > 0 ? `+${abs}` : `-${abs}`;
}

function statusFromVariance(variance: number): RegressionStatus {
  if (variance <= -0.75) return "UNDERPERFORMING";
  if (variance >= 0.75) return "OVERPERFORMING";
  return "ALIGNED";
}

function toneFromVariance(variance: number): string {
  if (variance < 0) return "text-emerald-400";
  if (variance > 0) return "text-rose-400";
  return "text-slate-400";
}

type XGIVarianceBadgeProps = {
  variance?: number | null;
  actualReturns?: number | null;
  /** Fallback when actualReturns is missing (GI column). */
  gi?: number | null;
  xGI: number;
  status?: RegressionStatus | null;
};

export function XGIVarianceBadge({
  variance,
  actualReturns,
  gi,
  xGI,
  status,
}: XGIVarianceBadgeProps) {
  const safeXgi = Number(xGI ?? 0);
  const safeReturns = Number(actualReturns ?? gi ?? Number.NaN);
  const derivedVar =
    typeof variance === "number" && !Number.isNaN(variance)
      ? variance
      : Number.isFinite(safeReturns)
        ? round(safeReturns - safeXgi, 2)
        : 0;
  const safeVariance = Number.isNaN(derivedVar) ? 0 : derivedVar;
  const safeStatus =
    status && STATUS_LABEL[status]
      ? status
      : statusFromVariance(safeVariance);
  const signed = formatSignedVariance(safeVariance);
  const displayReturns = Number.isFinite(safeReturns)
    ? safeReturns
    : round(safeVariance + safeXgi, 0);

  const tooltip = `Actual Returns (${displayReturns}) vs xGI (${safeXgi.toFixed(2)}) = ${signed} ${STATUS_LABEL[safeStatus]}`;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("tnum tabular-nums", toneFromVariance(safeVariance))}>
            {signed}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
