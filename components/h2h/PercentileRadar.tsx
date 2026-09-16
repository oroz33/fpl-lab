"use client";

import type { PlayerRow } from "@/lib/types";
import {
  formatRadarAxisPair,
  initialsFromName,
  peerPoolForPair,
  radarAxesForPair,
  radarPercentiles,
  type StatMode,
} from "@/lib/h2h/metrics";
import {
  RADAR_VIEWBOX,
  axisPoint,
  labelAnchor,
  polygonFromPercentiles,
  ringPoints,
} from "@/lib/h2h/radar";

export function PercentileRadar({
  playerA,
  playerB,
  allPlayers,
  mode,
}: {
  playerA: PlayerRow;
  playerB: PlayerRow;
  allPlayers: PlayerRow[];
  mode: StatMode;
}) {
  const axes = radarAxesForPair(playerA.position, playerB.position);
  const peers = peerPoolForPair(allPlayers, playerA.position, playerB.position);
  const pctA = radarPercentiles(playerA, peers, axes, mode);
  const pctB = radarPercentiles(playerB, peers, axes, mode);
  const valuesA = axes.map((ax) => pctA[ax.key] ?? 0);
  const valuesB = axes.map((ax) => pctB[ax.key] ?? 0);
  const shortA = initialsFromName(playerA.name);
  const shortB = initialsFromName(playerB.name);
  const peerPositions =
    playerA.position === playerB.position
      ? playerA.position
      : `${playerA.position}+${playerB.position}`;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="mb-space-sm flex w-full items-center justify-between px-space-sm">
        <div className="flex items-center gap-space-xs">
          <span className="text-[14px] font-semibold uppercase tracking-tight text-on-surface">
            Percentile Radar
          </span>
        </div>
        <div className="flex items-center gap-space-md text-[10px] font-medium">
          <span className="flex items-center gap-1 font-semibold text-on-tertiary-container">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-tertiary-fixed-dim" />
            {shortA}
          </span>
          <span className="flex items-center gap-1 font-semibold text-secondary">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-secondary-fixed-dim" />
            {shortB}
          </span>
        </div>
      </div>

      <div className="relative flex aspect-square w-full max-w-[380px] items-center justify-center py-space-xs">
        <svg className="h-full w-full overflow-visible" viewBox={RADAR_VIEWBOX}>
          {[1, 0.8, 0.6, 0.4, 0.2].map((frac, i) => (
            <polygon
              key={frac}
              points={ringPoints(frac)}
              fill="none"
              className="text-surface-container-high"
              stroke="currentColor"
              strokeWidth={i === 0 ? 1.2 : i === 3 ? 0.75 : 1}
              strokeDasharray={i === 3 ? "2,2" : undefined}
            />
          ))}
          {axes.map((_, i) => {
            const tip = axisPoint(i, 1);
            return (
              <line
                key={i}
                x1={160}
                y1={160}
                x2={tip.x}
                y2={tip.y}
                className="text-surface-container-high"
                stroke="currentColor"
                strokeWidth={1}
              />
            );
          })}

          {axes.map((axis, i) => {
            const anchor = labelAnchor(i);
            const label = formatRadarAxisPair(axis, playerA, playerB, mode);
            return (
              <text
                key={axis.key}
                x={anchor.x}
                y={anchor.y}
                textAnchor={anchor.textAnchor}
                className="fill-on-surface-variant font-data-mono text-[9.5px] font-semibold"
              >
                {label}
              </text>
            );
          })}

          <polygon
            points={polygonFromPercentiles(valuesB)}
            fill="#545d7c"
            fillOpacity={0.22}
            stroke="#545d7c"
            strokeWidth={1.75}
          />
          {valuesB.map((pct, i) => {
            const p = axisPoint(i, pct / 100);
            return <circle key={`b-${i}`} cx={p.x} cy={p.y} r={2.5} fill="#545d7c" />;
          })}

          <polygon
            points={polygonFromPercentiles(valuesA)}
            fill="#7ffc97"
            fillOpacity={0.3}
            stroke="#009842"
            strokeWidth={2}
          />
          {valuesA.map((pct, i) => {
            const p = axisPoint(i, pct / 100);
            return <circle key={`a-${i}`} cx={p.x} cy={p.y} r={3} fill="#009842" />;
          })}
        </svg>
      </div>
      <span className="mt-1 text-center text-[10px] font-medium text-on-surface-variant">
        Calibrated vs {peerPositions} peers with ≥180 mins
        {peers.length ? ` (n=${peers.length})` : ""}
      </span>
    </div>
  );
}
