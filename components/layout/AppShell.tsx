"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppNavFooter, AppNavLinks } from "@/components/layout/AppNavLinks";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();

  const registerIngestHandler = useCallback((handler: (() => void) | null) => {
    setIngestHandler(() => handler);
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const value = useMemo(
    () => ({ registerIngestHandler }),
    [registerIngestHandler]
  );

  return (
    <ShellContext.Provider value={value}>
      <AppHeader
        onIngested={ingestHandler ?? undefined}
        onOpenMobileNav={() => setMobileNavOpen(true)}
      />
      <AppSidebar />
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="py-space-lg">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="mb-space-md px-space-xl" />
          <AppNavLinks onNavigate={() => setMobileNavOpen(false)} />
          <AppNavFooter />
        </SheetContent>
      </Sheet>
      <div className="flex min-h-screen w-full flex-col pl-0 md:pl-64">
        <main className="w-full flex-1 bg-background pt-14">{children}</main>
      </div>
    </ShellContext.Provider>
  );
}
