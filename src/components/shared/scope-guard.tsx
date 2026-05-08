
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/use-permissions";
import { useLoadingStore } from "@/lib/stores/loading-store";

type ScopeMode = "any" | "all";

type ScopedTarget = {
  to: string;
  scopes: string[];
  mode?: ScopeMode;
};

function hasScopes(
  scopes: string[],
  mode: ScopeMode,
  canAny: (...scopeList: string[]) => boolean,
  canAll: (...scopeList: string[]) => boolean,
) {
  if (scopes.length === 0) return true;
  return mode === "all" ? canAll(...scopes) : canAny(...scopes);
}

export function RequireScopes({
  scopes,
  mode = "any",
  children,
  fallback = "/dashboard",
}: {
  scopes: string[];
  mode?: ScopeMode;
  children: React.ReactNode;
  fallback?: string;
}) {
  const { canAny, canAll } = usePermissions();
  const allowed = hasScopes(scopes, mode, canAny, canAll);

  useEffect(() => {
    if (allowed) return;
    const { show, hide } = useLoadingStore.getState();
    show("Redirecting...");
    return () => hide();
  }, [allowed]);

  if (!allowed) {
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}

export function ScopeRedirect({
  targets,
  fallback = "/dashboard",
}: {
  targets: ScopedTarget[];
  fallback?: string;
}) {
  const { canAny, canAll } = usePermissions();
  const target = targets.find((item) =>
    hasScopes(item.scopes, item.mode ?? "any", canAny, canAll),
  );

  return <Navigate to={target?.to ?? fallback} replace />;
}
