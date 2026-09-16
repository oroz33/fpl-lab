import { Suspense } from "react";
import { H2HCompareView } from "@/components/h2h/H2HCompareView";

export default function H2HPage() {
  return (
    <Suspense
      fallback={
        <div className="p-space-xl text-[13px] text-on-surface-variant">
          Loading H2H Compare…
        </div>
      }
    >
      <H2HCompareView />
    </Suspense>
  );
}
