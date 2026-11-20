"use client";

import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { ScatterPoint } from "@/lib/graphs/outliers";

export interface ScatterChartHandle {
  getImageDataUrl: () => string | null;
  resetZoom: () => void;
}

export interface ScatterChartProps {
  points: ScatterPoint[];
  labeledIds: Set<string>;
  xLabel: string;
  yLabel: string;
  entity: "players" | "teams";
  onReady?: () => void;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

export const ScatterChart = forwardRef<ScatterChartHandle, ScatterChartProps>(
  function ScatterChart(
    { points, labeledIds, xLabel, yLabel, entity, onReady },
    ref
  ) {
    const chartRef = useRef<ReactECharts>(null);

    useImperativeHandle(ref, () => ({
      getImageDataUrl: () => {
        const instance = chartRef.current?.getEchartsInstance();
        if (!instance) return null;
        return instance.getDataURL({
          type: "png",
          pixelRatio: 2,
          backgroundColor: "#f7f8fa",
        });
      },
      resetZoom: () => {
        const instance = chartRef.current?.getEchartsInstance();
        if (!instance) return;
        instance.dispatchAction({ type: "restore" });
      },
    }));

    const medX = useMemo(() => median(points.map((p) => p.x)), [points]);
    const medY = useMemo(() => median(points.map((p) => p.y)), [points]);

    const option = useMemo<EChartsOption>(() => {
      const data = points.map((p) => ({
        value: [p.x, p.y],
        name: p.name,
        team: p.team,
        id: p.id,
        label: {
          show: labeledIds.has(p.id),
          formatter: p.name,
          position: "top" as const,
          distance: 6,
          color: "#0b1c30",
          fontSize: 11,
          fontWeight: 600,
          backgroundColor: "rgba(247,248,250,0.85)",
          padding: [2, 4],
          borderRadius: 3,
        },
      }));

      return {
        backgroundColor: "#f7f8fa",
        animationDuration: 400,
        grid: {
          left: 64,
          right: 36,
          top: 40,
          bottom: 72,
        },
        tooltip: {
          trigger: "item",
          backgroundColor: "rgba(255,255,255,0.96)",
          borderColor: "#d8dee6",
          borderWidth: 1,
          textStyle: { color: "#0b1c30", fontSize: 12 },
          formatter: (params: unknown) => {
            const p = params as {
              data?: { name?: string; team?: string; value?: number[] };
            };
            const d = p.data;
            if (!d?.value) return "";
            const [x, y] = d.value;
            const teamLine =
              entity === "players" && d.team
                ? `<div style="color:#667788;margin-top:2px">${d.team}</div>`
                : "";
            return `
              <div style="font-weight:700;margin-bottom:4px">${d.name ?? ""}</div>
              ${teamLine}
              <div style="margin-top:6px">${xLabel}: <b>${Number(x).toFixed(2)}</b></div>
              <div>${yLabel}: <b>${Number(y).toFixed(2)}</b></div>
            `;
          },
        },
        toolbox: {
          right: 8,
          top: 4,
          itemSize: 14,
          feature: {
            dataZoom: {
              yAxisIndex: "all",
              title: {
                zoom: "Zoom area",
                back: "Zoom back",
              },
            },
            restore: { title: "Reset" },
          },
          iconStyle: { borderColor: "#667788" },
        },
        dataZoom: [
          {
            type: "inside",
            xAxisIndex: 0,
            filterMode: "none",
            zoomOnMouseWheel: true,
            moveOnMouseMove: true,
            moveOnMouseWheel: false,
          },
          {
            type: "inside",
            yAxisIndex: 0,
            filterMode: "none",
            zoomOnMouseWheel: true,
            moveOnMouseMove: true,
            moveOnMouseWheel: false,
          },
          {
            type: "slider",
            xAxisIndex: 0,
            height: 18,
            bottom: 18,
            borderColor: "#d8dee6",
            fillerColor: "rgba(37,99,235,0.12)",
            handleStyle: { color: "#2563eb" },
            textStyle: { color: "#667788", fontSize: 10 },
          },
        ],
        xAxis: {
          type: "value",
          name: xLabel,
          nameLocation: "middle",
          nameGap: 32,
          nameTextStyle: {
            color: "#0b1c30",
            fontWeight: 600,
            fontSize: 12,
          },
          splitLine: { lineStyle: { color: "#e4e8ee" } },
          axisLine: { lineStyle: { color: "#c5ced8" } },
          axisLabel: { color: "#667788", fontSize: 11 },
          scale: true,
        },
        yAxis: {
          type: "value",
          name: yLabel,
          nameLocation: "middle",
          nameGap: 44,
          nameTextStyle: {
            color: "#0b1c30",
            fontWeight: 600,
            fontSize: 12,
          },
          splitLine: { lineStyle: { color: "#e4e8ee" } },
          axisLine: { lineStyle: { color: "#c5ced8" } },
          axisLabel: { color: "#667788", fontSize: 11 },
          scale: true,
        },
        series: [
          {
            type: "scatter",
            symbolSize: entity === "teams" ? 14 : 10,
            itemStyle: {
              color: "#1e3a5f",
              opacity: 0.85,
              borderColor: "#ffffff",
              borderWidth: 1,
            },
            emphasis: {
              scale: 1.35,
              itemStyle: { color: "#dc2626", opacity: 1 },
            },
            data,
            markLine: {
              silent: true,
              symbol: "none",
              label: { show: false },
              lineStyle: {
                type: "dashed",
                color: "#dc2626",
                width: 1,
                opacity: 0.55,
              },
              data: [
                { xAxis: medX },
                {
                  yAxis: medY,
                  lineStyle: { color: "#16a34a", opacity: 0.55 },
                },
              ],
            },
          },
        ],
      };
    }, [points, labeledIds, xLabel, yLabel, entity, medX, medY]);

    return (
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ height: "100%", width: "100%", minHeight: 480 }}
        opts={{ renderer: "canvas" }}
        notMerge
        lazyUpdate
        onChartReady={() => onReady?.()}
      />
    );
  }
);
