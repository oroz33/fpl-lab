"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarRange,
  GitCompareArrows,
  Shield,
  Table2,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV = [
  {
    href: "/",
    label: "Player Data",
    icon: Table2,
    enabled: true,
  },
  {
    href: "/h2h",
    label: "H2H Compare",
    icon: GitCompareArrows,
    enabled: true,
  },
  {
    href: "/fixtures",
    label: "Fixture Tracker",
    icon: CalendarRange,
    enabled: true,
  },
  {
    href: "#",
    label: "Squad Planner",
    icon: Shield,
    enabled: false,
  },
  {
    href: "#",
    label: "Regression Lab",
    icon: TrendingUp,
    enabled: false,
  },
] as const;

export function AppNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-space-2xs px-space-md">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = item.enabled && pathname === item.href;
        const isTracker = item.href === "/fixtures";
        const className = cn(
          "flex items-center gap-space-md rounded-lg px-space-md py-space-sm transition-colors",
          active && isTracker
            ? "border border-blue-200/70 bg-blue-50/90 font-bold text-blue-700"
            : active
              ? "bg-surface-container-lowest font-semibold text-on-surface shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
              : item.enabled
                ? "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                : "select-none text-on-surface-variant/40"
        );

        if (!item.enabled) {
          return (
            <div
              key={item.label}
              className={cn(className, "justify-between")}
              aria-disabled="true"
            >
              <div className="flex items-center gap-space-md">
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className="text-[14px] font-semibold">{item.label}</span>
              </div>
              <span className="rounded bg-surface-container px-1.5 py-0.5 font-data-mono text-[10px] font-medium text-on-surface-variant">
                Coming Soon
              </span>
            </div>
          );
        }

        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={className}
            onClick={onNavigate}
          >
            <Icon
              className={cn(
                "h-[18px] w-[18px] shrink-0",
                active && isTracker && "text-blue-600"
              )}
            />
            <span
              className={cn(
                "text-[14px]",
                active && isTracker ? "font-bold" : "font-semibold"
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AppNavFooter() {
  return (
    <div className="mt-auto bg-surface-container-low px-space-md pt-space-md">
      <div className="rounded-lg bg-surface-container-lowest p-space-md shadow-[0_1px_4px_rgba(0,0,0,0.02)]">
        <div className="mb-space-2xs flex items-center justify-between text-[10px] font-medium text-on-surface-variant">
          <span>FEED LATENCY</span>
          <span className="font-data-mono text-[11px] text-on-surface">14ms</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-surface-container">
          <div className="h-1 w-5/6 bg-tertiary-fixed" />
        </div>
        <div className="mt-space-xs text-[10px] font-medium text-on-surface-variant">
          Premier League 24/25 • API Polling OK
        </div>
      </div>
    </div>
  );
}
