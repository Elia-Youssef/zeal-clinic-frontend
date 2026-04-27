"use client";

import { Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/use-permissions";

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

  if (!hasScopes(scopes, mode, canAny, canAll)) {
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
