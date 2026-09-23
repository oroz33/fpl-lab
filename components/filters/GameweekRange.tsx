"use client";

import { ChevronDown } from "lucide-react";

export function GameweekRange({
  from,
  to,
  max,
  onChange,
}: {
  from: number;
  to: number;
  max: number;
  onChange: (from: number, to: number) => void;
}) {
  const options = Array.from({ length: max }, (_, i) => i + 1);

  return (
    <div className="inline-flex min-h-11 shrink-0 items-center gap-space-xs rounded-lg bg-surface-container-low px-space-md py-1 md:min-h-0">
      <span className="text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">
        Gameweek
      </span>
      <div className="ml-1 flex items-center gap-1.5">
        <label className="inline-flex items-center gap-1 rounded bg-surface-container-lowest px-space-sm py-0.5 font-data-mono text-[11px] font-semibold text-on-surface shadow-sm">
          <select
            className="cursor-pointer bg-transparent outline-none"
            value={from}
            onChange={(e) => {
              const next = Number(e.target.value);
              onChange(next, Math.max(next, to));
            }}
          >
            {options.map((gw) => (
              <option key={gw} value={gw}>
                GW {gw}
              </option>
            ))}
          </select>
          <ChevronDown className="h-3.5 w-3.5 text-on-surface-variant" />
        </label>
        <span className="font-data-mono text-[11px] text-on-surface-variant">—</span>
        <label className="inline-flex items-center gap-1 rounded bg-surface-container-lowest px-space-sm py-0.5 font-data-mono text-[11px] font-semibold text-on-surface shadow-sm">
          <select
            className="cursor-pointer bg-transparent outline-none"
            value={to}
            onChange={(e) => {
              const next = Number(e.target.value);
              onChange(Math.min(from, next), next);
            }}
          >
            {options.map((gw) => (
              <option key={gw} value={gw}>
                GW {gw}
              </option>
            ))}
          </select>
          <ChevronDown className="h-3.5 w-3.5 text-on-surface-variant" />
        </label>
      </div>
    </div>
  );
}
