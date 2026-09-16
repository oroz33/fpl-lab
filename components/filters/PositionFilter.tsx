"use client";

import { cn } from "@/lib/utils";
import type { Position } from "@/lib/types";

const POSITIONS: Array<Position | "All"> = ["All", "GKP", "DEF", "MID", "FWD"];

export function PositionFilter({
  value,
  onChange,
  counts,
}: {
  value: Position | "All";
  onChange: (v: Position | "All") => void;
  counts?: Partial<Record<Position | "All", number>>;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-surface-container-low p-0.5">
      {POSITIONS.map((p) => {
        const active = value === p;
        const count = counts?.[p];
        return (
          <button
            key={p}
            type="button"
            onClick={() => onChange(p)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-space-md py-1 text-[11px] font-semibold tracking-[0.02em] uppercase transition-all",
              active
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            )}
          >
            <span>{p === "All" ? "ALL" : p}</span>
            {count != null && (
              <span
                className={cn(
                  "rounded px-1 py-0.5 font-data-mono text-[10px]",
                  active
                    ? "bg-surface-container-highest/20"
                    : "text-on-surface-variant/70"
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
