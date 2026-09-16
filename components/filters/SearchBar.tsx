"use client";

import { useEffect, useRef } from "react";
import { Search } from "lucide-react";

export function SearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="relative w-full sm:w-72">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search player, team, metric..."
        className="h-8 w-full rounded-lg bg-surface-container-low pr-12 pl-8 text-[12px] text-on-surface transition-all placeholder:text-on-surface-variant/60 hover:bg-surface-container focus:bg-surface-container-lowest focus:outline-none"
        type="text"
      />
      <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-0.5 rounded bg-surface-container px-1.5 py-0.5 font-data-mono text-[9px] font-semibold tracking-wider text-on-surface-variant uppercase">
        ⌘K
      </div>
    </div>
  );
}
