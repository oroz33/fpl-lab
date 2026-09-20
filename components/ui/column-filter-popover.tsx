"use client";

import { useMemo, useState } from "react";
import { Filter, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn, round } from "@/lib/utils";

function percentileThreshold(
  values: number[],
  pct: number,
  lowerIsBetter: boolean
): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);

  if (lowerIsBetter) {
    // Easiest Top N% → threshold at Nth percentile from bottom
    const index = Math.min(
      sorted.length - 1,
      Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1)
    );
    return sorted[index] ?? 0;
  }

  // Top N% means threshold at (100-N) percentile from bottom
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1)
  );
  const topIndex = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor(((100 - pct) / 100) * sorted.length))
  );
  return sorted[topIndex] ?? sorted[index] ?? 0;
}

function formatThreshold(value: number, digits: number): string {
  return value.toFixed(digits);
}

export function ColumnFilterPopover({
  label,
  values,
  applied,
  onApply,
  onReset,
  active,
  lowerIsBetter = false,
  digits = 2,
}: {
  label: string;
  values: number[];
  applied?: string;
  onApply: (threshold: number) => void;
  onReset: () => void;
  active?: boolean;
  lowerIsBetter?: boolean;
  digits?: number;
}) {
  const op = lowerIsBetter ? "≤" : "≥";
  const step = digits === 0 ? 1 : 10 ** -digits;
  const [open, setOpen] = useState(false);
  const max = useMemo(() => {
    if (!values.length) return 1;
    const raw = Math.max(...values, digits === 0 ? 1 : 0.01);
    return digits === 0 ? Math.ceil(raw) : raw;
  }, [values, digits]);

  const top10 = useMemo(
    () => round(percentileThreshold(values, 10, lowerIsBetter), digits),
    [values, lowerIsBetter, digits]
  );
  const top25 = useMemo(
    () => round(percentileThreshold(values, 25, lowerIsBetter), digits),
    [values, lowerIsBetter, digits]
  );

  const appliedNum =
    applied && Number.isFinite(Number(applied))
      ? round(Number(applied), digits)
      : null;
  const defaultDraft = lowerIsBetter ? max : 0;
  const initial = appliedNum ?? defaultDraft;
  const [draft, setDraft] = useState(initial);
  const [preset, setPreset] = useState<string | null>(
    appliedNum != null ? `${op} ${formatThreshold(appliedNum, digits)}` : null
  );

  function setDraftRounded(value: number) {
    setDraft(round(value, digits));
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      const nextInitial = appliedNum ?? (lowerIsBetter ? max : 0);
      setDraft(nextInitial);
      setPreset(
        appliedNum != null
          ? `${op} ${formatThreshold(appliedNum, digits)}`
          : null
      );
    }
    setOpen(next);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "rounded p-0.5 transition-colors hover:bg-white/15",
            active ? "text-tertiary-fixed" : "text-on-primary/60 hover:text-on-primary"
          )}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Filter ${label}`}
        >
          <Filter className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="normal-case"
        onClick={(e) => e.stopPropagation()}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between border-b border-surface-container pb-2">
          <span className="flex items-center gap-1.5 text-[14px] font-semibold text-on-surface">
            <Filter className="h-4 w-4 text-primary" />
            Filter {label}
          </span>
          <button
            type="button"
            className="text-on-surface-variant hover:text-on-surface"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-space-sm py-space-md">
          <div className="flex items-center justify-between text-[10px] font-medium text-on-surface-variant">
            <span>THRESHOLD</span>
            <span className="font-data-mono font-bold tabular-nums text-primary">
              {op} {formatThreshold(draft, digits)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={max}
            step={step}
            value={Math.min(draft, max)}
            onChange={(e) => {
              setDraftRounded(Number(e.target.value));
              setPreset(null);
            }}
            className="h-1.5 w-full cursor-pointer accent-primary"
          />
          <div className="flex items-center gap-1 pt-1">
            <button
              type="button"
              className={cn(
                "rounded px-2 py-0.5 font-data-mono text-[10px] tabular-nums transition-colors",
                preset === "Top 10%"
                  ? "bg-surface-container font-semibold text-primary"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              )}
              onClick={() => {
                setDraft(top10);
                setPreset("Top 10%");
              }}
            >
              Top 10%
            </button>
            <button
              type="button"
              className={cn(
                "rounded px-2 py-0.5 font-data-mono text-[10px] tabular-nums transition-colors",
                preset === "Top 25%"
                  ? "bg-surface-container font-semibold text-primary"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              )}
              onClick={() => {
                setDraft(top25);
                setPreset("Top 25%");
              }}
            >
              Top 25%
            </button>
            <button
              type="button"
              className={cn(
                "rounded px-2 py-0.5 font-data-mono text-[10px] tabular-nums transition-colors",
                preset?.startsWith(op)
                  ? "bg-surface-container font-semibold text-primary"
                  : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              )}
              onClick={() => {
                const v = round(draft, digits);
                setDraft(v);
                setPreset(`${op} ${formatThreshold(v, digits)}`);
              }}
            >
              {op} {formatThreshold(draft, digits)}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-surface-container pt-2">
          <button
            type="button"
            className="text-[11px] font-semibold text-on-surface-variant transition-colors hover:text-error"
            onClick={() => {
              onReset();
              setDraft(lowerIsBetter ? max : 0);
              setPreset(null);
              setOpen(false);
            }}
          >
            Reset
          </button>
          <button
            type="button"
            className="rounded bg-primary px-space-md py-1 text-[11px] font-semibold text-on-primary transition-colors hover:bg-primary-container"
            onClick={() => {
              onApply(round(draft, digits));
              setOpen(false);
            }}
          >
            Apply Filter
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
