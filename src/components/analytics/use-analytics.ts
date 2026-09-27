import { useEffect, useState } from "react";
import { useAdjustOnChange } from "@/hooks/use-adjust-on-change";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";

export function useAnalytics<T>(endpoint: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // A new endpoint is loading from the render that asks for it.
  useAdjustOnChange([endpoint], () => {
    setLoading(true);
    setError(null);
  });

  useEffect(() => {
    let cancelled = false;
    api
      .get<T>(endpoint)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  return { data, loading, error };
}
