/** Pure SVG hexagon radar geometry (center 160,160; outer radius 120). */

export type Point = { x: number; y: number };

const CX = 160;
const CY = 160;
const R = 120;

/** Six axes, clockwise from top (same order as radarAxesForPair). */
export function axisPoint(axisIndex: number, radiusFraction: number): Point {
  const angle = -Math.PI / 2 + (axisIndex * 2 * Math.PI) / 6;
  const r = R * Math.max(0, Math.min(1, radiusFraction));
  return {
    x: round2(CX + r * Math.cos(angle)),
    y: round2(CY + r * Math.sin(angle)),
  };
}

export function ringPoints(radiusFraction: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const p = axisPoint(i, radiusFraction);
    return `${p.x},${p.y}`;
  }).join(" ");
}

export function polygonFromPercentiles(pcts: number[]): string {
  return pcts
    .map((pct, i) => {
      const p = axisPoint(i, pct / 100);
      return `${p.x},${p.y}`;
    })
    .join(" ");
}

export function labelAnchor(axisIndex: number): {
  x: number;
  y: number;
  textAnchor: "start" | "middle" | "end";
} {
  const p = axisPoint(axisIndex, 1.18);
  let textAnchor: "start" | "middle" | "end" = "middle";
  if (axisIndex === 1 || axisIndex === 2) textAnchor = "start";
  if (axisIndex === 4 || axisIndex === 5) textAnchor = "end";
  return { x: p.x, y: p.y, textAnchor };
}

function round2(n: number): number {
  return Math.round(n * 10) / 10;
}

export const RADAR_VIEWBOX = "0 0 320 320";
