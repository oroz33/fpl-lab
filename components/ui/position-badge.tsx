import { cn } from "@/lib/utils";
import type { Position } from "@/lib/types";

const POSITION_STYLES: Record<Position, string> = {
  GKP: "bg-primary-fixed-dim text-on-primary-fixed",
  DEF: "bg-secondary text-on-secondary",
  MID: "bg-tertiary text-on-tertiary",
  FWD: "bg-error text-on-error",
};

export function PositionBadge({ position }: { position: Position }) {
  return (
    <span
      className={cn(
        "inline-flex h-[18px] w-7 items-center justify-center rounded text-[9px] font-bold tracking-wide",
        POSITION_STYLES[position]
      )}
    >
      {position}
    </span>
  );
}
