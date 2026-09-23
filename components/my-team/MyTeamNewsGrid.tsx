"use client";

import { BadgeCheck, PlusCircle, RefreshCw, XCircle } from "lucide-react";
import { PositionBadge } from "@/components/ui/position-badge";
import { TeamAccentLabel } from "@/components/ui/team-accent";
import { resolveTeamAccent } from "@/lib/constants/teams";
import { shortName } from "@/lib/h2h/metrics";
import {
  expectedXiLabel,
  resolvePlayerIntel,
} from "@/lib/squad/player-intel";
import type {
  ExpectedXiStatus,
  FitnessTone,
  PlayerRow,
  SquadMissingSlot,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const COL_COUNT = 6;

const BADGE_BASE =
  "inline-flex max-w-full items-center gap-space-2xs rounded px-space-xs py-space-2xs text-[10px] font-bold tracking-wider uppercase";

function expectedXiClass(status: ExpectedXiStatus): string {
  switch (status) {
    case "STARTER":
      return "bg-emerald-600 text-white";
    case "ROTATION_RISK":
      return "bg-secondary-container text-on-secondary-container";
    case "RULED_OUT":
      return "bg-error-container text-on-error-container";
  }
}

function fitnessClass(tone: FitnessTone, label: string): string {
  if (tone === "out") return "bg-error-container text-on-error-container";
  if (tone === "doubt") {
    return "bg-secondary-container text-on-secondary-container";
  }
  if (/midweek\s+rested/i.test(label)) {
    return "bg-emerald-800 text-white";
  }
  return "bg-emerald-600 text-white";
}

function ExpectedXiBadge({ status }: { status: ExpectedXiStatus }) {
  const Icon =
    status === "STARTER"
      ? BadgeCheck
      : status === "ROTATION_RISK"
        ? RefreshCw
        : XCircle;
  return (
    <span className={cn(BADGE_BASE, expectedXiClass(status))}>
      <Icon className="h-[14px] w-[14px] shrink-0" aria-hidden />
      <span className="truncate">{expectedXiLabel(status)}</span>
    </span>
  );
}

function FitnessBadge({
  tone,
  label,
}: {
  tone: FitnessTone;
  label: string;
}) {
  return (
    <span className={cn(BADGE_BASE, fitnessClass(tone, label))}>
      <span className="truncate">{label}</span>
    </span>
  );
}

export function MyTeamNewsGrid({
  squadPlayers,
  missingSlots,
  onSelectSlot,
}: {
  squadPlayers: PlayerRow[];
  missingSlots: SquadMissingSlot[];
  onSelectSlot: (position?: SquadMissingSlot["position"]) => void;
}) {
  return (
    <div className="w-full overflow-hidden rounded-b bg-surface-container-lowest shadow-sm">
      <div className="relative w-full overflow-x-auto">
        <table className="w-full border-collapse select-none text-left">
          <thead>
            <tr className="h-table-row-h bg-primary text-[11px] font-semibold tracking-[0.02em] text-on-primary uppercase">
              <th className="w-14 px-cell-px">POS</th>
              <th className="w-44 px-cell-px">PLAYER</th>
              <th className="w-24 px-cell-px">TEAM</th>
              <th className="w-40 px-cell-px">EXPECTED XI</th>
              <th className="w-52 px-cell-px">FITNESS STATUS</th>
              <th className="px-cell-px">MANAGER PRESS QUOTE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container text-[12px]">
            {squadPlayers.map((row) => {
              const intel = resolvePlayerIntel(row);
              return (
                <tr
                  key={row.id}
                  className="h-table-row-h transition-colors duration-75 hover:bg-surface-container-low"
                >
                  <td className="px-cell-px">
                    <PositionBadge position={row.position} />
                  </td>
                  <td className="px-cell-px">
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <span
                        className="inline-block h-5 w-1 shrink-0 rounded-xs border border-white/10"
                        style={{
                          backgroundColor: resolveTeamAccent({
                            teamId: row.teamId,
                          }),
                        }}
                        aria-hidden
                      />
                      <span className="truncate text-[13px] font-bold text-on-surface">
                        {shortName(row.name)}
                      </span>
                    </span>
                  </td>
                  <td className="px-cell-px">
                    <TeamAccentLabel
                      label={row.teamShort}
                      teamId={row.teamId}
                    />
                  </td>
                  <td className="px-cell-px">
                    <ExpectedXiBadge status={intel.expectedXi} />
                  </td>
                  <td className="px-cell-px">
                    <FitnessBadge
                      tone={intel.fitnessTone}
                      label={intel.fitnessLabel}
                    />
                  </td>
                  <td
                    className="max-w-0 px-cell-px italic text-on-surface-variant"
                    title={`${intel.managerName}: ${intel.quote}`}
                  >
                    <span className="line-clamp-2">
                      <strong className="not-italic font-semibold text-on-surface">
                        {intel.managerName}:
                      </strong>{" "}
                      “{intel.quote}”
                    </span>
                  </td>
                </tr>
              );
            })}

            {missingSlots.map((slot) => (
              <tr
                key={slot.key}
                className="h-table-row-h cursor-pointer bg-surface-container-low/30 transition-colors duration-75 hover:bg-surface-container-low/70"
                onClick={() => onSelectSlot(slot.position)}
              >
                <td className="px-cell-px py-2 text-center" colSpan={COL_COUNT}>
                  <div className="flex items-center justify-center gap-2 rounded border border-dashed border-outline-variant/60 px-3 py-1 text-outline transition-colors hover:border-outline hover:text-on-surface">
                    <PlusCircle className="h-[15px] w-[15px] shrink-0" />
                    <span className="font-data-mono text-[11px] font-medium tracking-wide uppercase">
                      [{slot.position} #{slot.slotIndex}] Select Here To Add
                      Your Player
                    </span>
                  </div>
                </td>
              </tr>
            ))}

            {squadPlayers.length === 0 && missingSlots.length === 0 ? (
              <tr>
                <td
                  colSpan={COL_COUNT}
                  className="px-cell-px py-8 text-center text-[13px] text-on-surface-variant"
                >
                  No players selected. Edit Squad to build your 15.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
