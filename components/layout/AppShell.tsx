"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppSidebar } from "@/components/layout/AppSidebar";

type ShellContextValue = {
  registerIngestHandler: (handler: (() => void) | null) => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function useAppShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) {
    throw new Error("useAppShell must be used within AppShell");
  }
  return ctx;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [ingestHandler, setIngestHandler] = useState<(() => void) | null>(null);

  const registerIngestHandler = useCallback((handler: (() => void) | null) => {
    setIngestHandler(() => handler);
  }, []);

  const value = useMemo(
    () => ({ registerIngestHandler }),
    [registerIngestHandler]
  );

  return (
    <ShellContext.Provider value={value}>
      <AppHeader onIngested={ingestHandler ?? undefined} />
      <AppSidebar />
      <div className="flex min-h-screen w-full flex-col pl-64">
        <main className="w-full flex-1 bg-background pt-14">{children}</main>
      </div>
    </ShellContext.Provider>
  );
}
