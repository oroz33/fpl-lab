"use client";

import { AppNavFooter, AppNavLinks } from "@/components/layout/AppNavLinks";

export function AppSidebar() {
  return (
    <aside className="fixed top-14 bottom-0 left-0 z-40 hidden w-64 flex-col bg-surface-container-low py-space-lg md:flex">
      <div className="mb-space-md px-space-xl" />
      <AppNavLinks />
      <AppNavFooter />
    </aside>
  );
}
