import { lazy, type ComponentType } from "react";

/** sessionStorage flag: this tab already reloaded once for a chunk that failed to load. */
export const RELOAD_FLAG = "chunk-reload";

export type PageModule = { default: ComponentType };

/**
 * Loads a page chunk. A chunk that fails to load is nearly always a stale
 * page after a new build: the file names it knows are gone from the server.
 * The page then reloads itself once, flagged in sessionStorage, so that a
 * second failure reaches the error screen instead of looping.
 */
export async function loadPage(
  load: () => Promise<PageModule>,
): Promise<PageModule> {
  try {
    const page = await load();
    sessionStorage.removeItem(RELOAD_FLAG);
    return page;
  } catch (error) {
    if (sessionStorage.getItem(RELOAD_FLAG)) throw error;
    sessionStorage.setItem(RELOAD_FLAG, "1");
    window.location.reload();
    // The reload takes over; the route keeps its fallback until then.
    return new Promise<PageModule>(() => {});
  }
}

/** A page component fetched on first visit, in its own chunk. */
export function lazyPage(load: () => Promise<PageModule>) {
  return lazy(() => loadPage(load));
}
