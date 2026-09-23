"use client";

import { ChevronUp } from "lucide-react";

export function TeamFilter({
  teams,
  selected,
  onChange,
}: {
  teams: { id: string; name: string; shortName: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div className="relative">
      <label className="inline-flex h-11 min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-lg bg-surface-container-low px-space-md text-[13px] text-on-surface transition-colors hover:bg-surface-container md:h-8 md:min-h-0">
        <span className="h-2.5 w-2.5 rounded-full bg-secondary" />
        <select
          className="cursor-pointer appearance-none bg-transparent pr-1 text-[14px] font-semibold outline-none"
          value={selected[0] ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v ? [v] : []);
          }}
        >
          <option value="">All Teams ({teams.length || 20})</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.shortName} — {t.name}
            </option>
          ))}
        </select>
        <ChevronUp className="h-4 w-4 rotate-180 text-on-surface-variant" />
      </label>
    </div>
  );
}
