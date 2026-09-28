import { useCallback, useEffect, useRef, useState } from "react";

import { useAdjustOnChange } from "@/hooks/use-adjust-on-change";
import { getErrorMessage } from "@/lib/utils";

/** What a reload may be asked to do. */
export interface ReloadOptions {
  /** Keep the current data on screen while the fetch runs (after a save, say). */
  quiet?: boolean;
}

export interface UseApiQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: (options?: ReloadOptions) => void;
}

/**
 * Runs `fetch` on mount and whenever `deps` change (each entry compared with
 * Object.is) and keeps the answer. A load that starts while another one is in
 * flight makes the older one's answer count for nothing, whatever their order.
 * Unmounting voids the loads in flight (their answers never land and never
 * reach `onError`), and a `reload` called after unmount starts nothing.
 * A failed load sets `error` and calls `onError` with the raw error; the data
 * on hand stays only while it answers the same query (a failed reload), and is
 * dropped once the deps have moved on, so one query's answer never stands in
 * for another's. `reload({ quiet: true })` runs the same fetch with the
 * current data kept on screen; `reload()` shows the loading state again.
 */
export function useApiQuery<T>(
  fetch: () => Promise<T>,
  deps: readonly unknown[],
  onError?: (error: unknown) => void,
): UseApiQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // The callbacks to use when a load starts: the latest render's, so a started
  // load never restarts because their identities changed. Synced in an effect
  // because a load starts from an effect or an event, always after a commit.
  const fetchRef = useRef(fetch);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    fetchRef.current = fetch;
    onErrorRef.current = onError;
  });

  // Each started load takes a ticket; its answer only lands while it is the newest.
  const ticket = useRef(0);
  // Whether the load effect below is in place: true from its run until its
  // cleanup, so false once the component has unmounted.
  const active = useRef(false);
  const [runId, setRunId] = useState(0);
  // Whether `data` answers the current deps: false from a deps change until
  // a load for them lands.
  const dataIsCurrent = useRef(false);

  const run = useCallback(() => {
    if (!active.current) return;
    const current = ++ticket.current;
    fetchRef
      .current()
      .then((result) => {
        if (ticket.current !== current) return;
        dataIsCurrent.current = true;
        setData(result);
        setError(null);
      })
      .catch((err) => {
        if (ticket.current !== current) return;
        if (!dataIsCurrent.current) setData(null);
        setError(getErrorMessage(err));
        onErrorRef.current?.(err);
      })
      .finally(() => {
        if (ticket.current !== current) return;
        setLoading(false);
      });
  }, []);

  // A new query is loading from the render that asks for it.
  useAdjustOnChange(deps, () => {
    setLoading(true);
    setError(null);
    setRunId((n) => n + 1);
  });

  // The adjust above already shows the loading state; this marks the data on
  // hand as another query's and starts the load. Its cleanup, when the deps
  // move on or the component unmounts, voids every load started so far (a
  // fresh ticket) and lets no new one start until the effect runs again, which
  // after unmount it never does.
  useEffect(() => {
    active.current = true;
    dataIsCurrent.current = false;
    run();
    return () => {
      active.current = false;
      ticket.current += 1;
    };
  }, [run, runId]);

  const reload = useCallback(
    (options?: ReloadOptions) => {
      if (!options?.quiet) {
        setLoading(true);
        setError(null);
      }
      run();
    },
    [run],
  );

  return { data, loading, error, reload };
}
