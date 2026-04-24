import { useAuthStore } from "@/lib/stores/auth-store";

export function usePermissions() {
  const scopes = useAuthStore((s) => s.scopes);

  /** Check if the user has a specific scope. */
  const can = (scope: string) => scopes.includes(scope);

  /** Check if the user has at least one of the given scopes. */
  const canAny = (...scopeList: string[]) =>
    scopeList.some((s) => scopes.includes(s));

  /** Check if the user has all of the given scopes. */
  const canAll = (...scopeList: string[]) =>
    scopeList.every((s) => scopes.includes(s));

  return { can, canAny, canAll, scopes };
}
