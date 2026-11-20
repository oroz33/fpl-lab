import { jsPDF } from "jspdf";
import type { GraphCacheEntry } from "@/lib/graphs/chart-cache";

export function downloadGraphPdf(entry: GraphCacheEntry): void {
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });

  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 36;
  const headerH = 52;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(entry.title, margin, margin + 14);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(80);
  const subtitle = [
    entry.entity === "players" ? "Players" : "Teams",
    `GW ${entry.fromGw}–${entry.toGw}`,
    `X: ${entry.xLabel}`,
    `Y: ${entry.yLabel}`,
  ].join("  ·  ");
  pdf.text(subtitle, margin, margin + 32);

  pdf.setFontSize(8);
  pdf.setTextColor(120);
  pdf.text(
    `Generated ${new Date(entry.createdAt).toLocaleString()}  ·  FPL Lab`,
    margin,
    margin + 46
  );
  pdf.setTextColor(0);

  const imgMaxW = pageW - margin * 2;
  const imgMaxH = pageH - margin - headerH - margin;
  const props = pdf.getImageProperties(entry.imageDataUrl);
  const ratio = Math.min(imgMaxW / props.width, imgMaxH / props.height);
  const imgW = props.width * ratio;
  const imgH = props.height * ratio;
  const imgX = margin + (imgMaxW - imgW) / 2;
  const imgY = margin + headerH;

  pdf.addImage(entry.imageDataUrl, "PNG", imgX, imgY, imgW, imgH);

  const safeName = entry.title.replace(/[^\w\-]+/g, "_").slice(0, 60);
  pdf.save(`${safeName || "fpl-lab-graph"}.pdf`);
}
