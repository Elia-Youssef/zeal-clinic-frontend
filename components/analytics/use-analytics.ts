import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";

/**
 * Fetch any analytics endpoint and expose { data, loading, error }.
 * Callers narrow `T` so each analytics component owns its own response shape.
 */
export function useAnalytics<T>(endpoint: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
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
