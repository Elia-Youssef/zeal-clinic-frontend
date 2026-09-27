const REDIRECT_KEY = "auth_redirect";
const DEFAULT_DESTINATION = "/dashboard";

function isSafeInternalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && path !== "/";
}

export function storeAuthRedirect(path: string): void {
  if (!isSafeInternalPath(path)) return;
  sessionStorage.setItem(REDIRECT_KEY, path);
}

export function consumeAuthRedirect(): string {
  const path = sessionStorage.getItem(REDIRECT_KEY);
  sessionStorage.removeItem(REDIRECT_KEY);
  return path && isSafeInternalPath(path) ? path : DEFAULT_DESTINATION;
}
