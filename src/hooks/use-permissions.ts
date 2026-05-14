import { useAuthStore } from "@/lib/stores/auth-store";

export function usePermissions() {
  const scopes = useAuthStore((s) => s.scopes);

  const can = (scope: string) => scopes.includes(scope);

  const canAny = (...scopeList: string[]) =>
    scopeList.some((s) => scopes.includes(s));

  const canAll = (...scopeList: string[]) =>
    scopeList.every((s) => scopes.includes(s));

  return { can, canAny, canAll, scopes };
}
