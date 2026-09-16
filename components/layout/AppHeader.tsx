"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, CloudUpload, Link2, User } from "lucide-react";
import { FplLabLogo } from "@/components/ui/logo";
import { UploadPortal } from "@/components/upload/UploadPortal";
import { cn } from "@/lib/utils";

export function AppHeader({ onIngested }: { onIngested?: () => void }) {
  const pathname = usePathname();
  const onBatch = pathname?.startsWith("/opta-batch");

  return (
    <header className="fixed top-0 right-0 left-0 z-50 h-14 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="flex h-14 w-full items-center justify-between gap-space-lg px-space-xl">
        <Link href="/" className="flex items-center gap-space-md">
          <FplLabLogo className="h-8 w-auto" />
        </Link>

        <div className="flex items-center gap-space-md">
          <Link
            href="/opta-batch"
            className={cn(
              "hidden items-center gap-space-xs rounded-lg px-space-md py-space-xs text-[14px] font-semibold transition-colors sm:inline-flex",
              onBatch
                ? "bg-primary text-on-primary"
                : "bg-surface-container text-on-surface hover:bg-surface-container-high"
            )}
          >
            <Link2 className="h-4 w-4" />
            <span>Batch Links</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Link>

          {onIngested ? (
            <UploadPortal onIngested={onIngested} />
          ) : (
            <Link
              href="/"
              className="inline-flex items-center gap-space-xs rounded-lg bg-primary px-space-lg py-space-xs text-[14px] font-semibold text-on-primary transition-colors hover:bg-primary-container"
            >
              <CloudUpload className="h-4 w-4" />
              <span>Upload Opta Feed</span>
            </Link>
          )}

          <div className="ml-space-xs flex h-8 w-8 items-center justify-center rounded-full bg-primary">
            <User className="h-[18px] w-[18px] text-on-primary" />
          </div>
        </div>
      </div>
    </header>
  );
}
