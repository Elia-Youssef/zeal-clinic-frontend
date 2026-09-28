import { api } from "@/lib/api";
import { useApiQuery } from "@/hooks/use-api-query";

/**
 * Loads one analytics endpoint, path and query string as the caller builds
 * them, and loads it again whenever that changes.
 */
export function useAnalytics<T>(endpoint: string) {
  return useApiQuery(() => api.get<T>(endpoint), [endpoint]);
}
