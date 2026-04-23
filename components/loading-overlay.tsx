"use client";

import { Loader2 } from "lucide-react";
import { useLoadingStore } from "@/lib/stores/loading-store";

export function LoadingOverlay() {
  const visible = useLoadingStore((s) => s.count > 0);
  const message = useLoadingStore((s) => s.message);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-200 flex items-center justify-center bg-background"
    >
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
        {message ? <span className="text-sm">{message}</span> : null}
      </div>
    </div>
  );
}
