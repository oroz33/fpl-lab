import { resolveTeamAccent } from "@/lib/constants/teams";

export function TeamAccentLabel({
  label,
  teamId,
  code,
}: {
  label: string;
  teamId?: string;
  code?: string;
}) {
  const accent = resolveTeamAccent({ teamId, code });
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-3.5 w-1 shrink-0 rounded-xs border border-white/10"
        style={{ backgroundColor: accent }}
        aria-hidden
      />
      <span className="truncate">{label}</span>
    </span>
  );
}
