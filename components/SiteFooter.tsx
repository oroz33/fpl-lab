import packageJson from "@/package.json";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border-interior bg-surface-container-low">
      <div className="flex flex-wrap items-center justify-between gap-space-md px-space-xl py-space-md font-data-mono text-[11px] text-on-surface-variant">
        <div className="flex flex-wrap items-center gap-space-md">
          <span className="inline-flex items-center gap-space-xs text-on-surface">
            <span className="h-2 w-2 rounded-full bg-tertiary-fixed" />
            <span className="font-semibold">Feed Pipeline: Ready</span>
          </span>
          <span className="text-surface-variant">•</span>
          <span>Local Opta Bridge v{packageJson.version}</span>
          <span className="text-surface-variant">•</span>
          <span>Port 8080 Active</span>
        </div>
        <div className="flex items-center gap-space-md">
          <span className="text-[10px] font-medium uppercase tracking-wide">
            © {year} Or Oz. All rights reserved.
          </span>
          <span className="rounded bg-surface-container px-space-sm py-space-2xs text-[10px] font-bold uppercase tracking-[0.03em] text-on-surface">
            v{packageJson.version}
          </span>
        </div>
      </div>
    </footer>
  );
}
