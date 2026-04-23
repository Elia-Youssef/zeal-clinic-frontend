import { useCallback } from "react";
import { useLoadingStore } from "@/lib/stores/loading-store";

export function useLoading() {
  const show = useLoadingStore((s) => s.show);
  const hide = useLoadingStore((s) => s.hide);
  const isLoading = useLoadingStore((s) => s.count > 0);

  const withLoading = useCallback(
    async <T>(fn: () => Promise<T>, message?: string): Promise<T> => {
      show(message);
      try {
        return await fn();
      } finally {
        hide();
      }
    },
    [show, hide],
  );

  return { show, hide, isLoading, withLoading };
}
