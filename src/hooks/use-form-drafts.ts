import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConfirm } from "@/hooks/use-confirm";
import {
  useDraftGroup,
  useFormDraftsStore,
  type FormDraft,
} from "@/lib/stores/form-drafts-store";

// "off" = no drafts; "manual" = saved only via a Save-draft button; "auto" = debounced autosave.
export type DraftMode = "off" | "manual" | "auto";

type Options<T> = {
  group?: string; // omit (or mode "off") to disable
  mode?: DraftMode;
  open: boolean;
  snapshot: T;
  apply: (data: T) => void;
  blank: () => void;
  isEmpty?: (data: T) => boolean; // don't persist "empty" snapshots
  label?: (data: T) => string;
  initialId?: string; // auto-load this draft on open if it exists
  autosaveMs?: number;
};

export type FormDraftsApi<T> = {
  enabled: boolean;
  mode: DraftMode;
  list: FormDraft<T>[];
  activeId: string | null;
  isNew: boolean;
  dirty: boolean;
  showSaveButton: boolean;
  saveNow: () => void;
  selectNew: () => void;
  loadDraft: (id: string) => void;
  deleteDraft: (id: string) => void;
  discardActive: () => void; // remove active draft without confirm (after submit)
};

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useFormDrafts<T>(opts: Options<T>): FormDraftsApi<T> {
  const {
    group,
    mode = "off",
    open,
    snapshot,
    initialId,
    autosaveMs = 700,
  } = opts;

  const enabled = !!group && mode !== "off";

  const rawList = useDraftGroup<T>(enabled ? group : undefined);
  const list = useMemo(
    () => [...rawList].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [rawList],
  );

  const saveDraftStore = useFormDraftsStore((s) => s.saveDraft);
  const removeDraftStore = useFormDraftsStore((s) => s.removeDraft);
  const confirm = useConfirm();

  const [activeId, setActiveId] = useState<string | null>(null);
  // State (not a ref) so `dirty` / the Save-draft button react to it.
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Latest callbacks in refs so effects don't churn on every render. Synced in
  // an effect (not during render) per react-hooks/refs.
  const applyRef = useRef(opts.apply);
  const blankRef = useRef(opts.blank);
  const labelRef = useRef(opts.label);
  const isEmptyRef = useRef(opts.isEmpty);
  useEffect(() => {
    applyRef.current = opts.apply;
    blankRef.current = opts.blank;
    labelRef.current = opts.label;
    isEmptyRef.current = opts.isEmpty;
  });

  const serialized = useMemo(
    () => (enabled ? JSON.stringify(snapshot) : ""),
    [enabled, snapshot],
  );

  const write = useCallback(
    (id: string, data: T) => {
      saveDraftStore(group!, {
        id,
        label: labelRef.current?.(data) ?? "Draft",
        data,
      });
      setLastSaved(JSON.stringify(data));
    },
    [group, saveDraftStore],
  );

  // On open: auto-load initialId if present, else start a fresh draft.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    if (open && !wasOpen.current) {
      const seed = initialId
        ? useFormDraftsStore.getState().getDraft<T>(group!, initialId)
        : undefined;
      if (seed) {
        setActiveId(seed.id);
        setLastSaved(JSON.stringify(seed.data));
        applyRef.current(seed.data);
      } else {
        setActiveId(newId());
        setLastSaved(null);
      }
    }
    wasOpen.current = open;
  }, [open, enabled, group, initialId]);

  useEffect(() => {
    if (!enabled || mode !== "auto" || !open || !activeId) return;
    if (isEmptyRef.current?.(snapshot)) return;
    if (serialized === lastSaved) return;
    const t = setTimeout(() => write(activeId, snapshot), autosaveMs);
    return () => clearTimeout(t);
  }, [
    serialized,
    lastSaved,
    enabled,
    mode,
    open,
    activeId,
    autosaveMs,
    snapshot,
    write,
  ]);

  const saveNow = useCallback(() => {
    if (!enabled || !activeId) return;
    if (serialized === lastSaved) return;
    write(activeId, snapshot);
  }, [enabled, activeId, write, snapshot, serialized, lastSaved]);

  const selectNew = useCallback(() => {
    setActiveId(newId());
    setLastSaved(null);
    blankRef.current();
  }, []);

  const loadDraft = useCallback(
    (id: string) => {
      const d = useFormDraftsStore.getState().getDraft<T>(group!, id);
      if (!d) return;
      setActiveId(id);
      setLastSaved(JSON.stringify(d.data));
      applyRef.current(d.data);
    },
    [group],
  );

  const deleteDraft = useCallback(
    async (id: string) => {
      const ok = await confirm({
        title: "Delete draft?",
        description: "This draft will be permanently removed.",
        confirmText: "Delete",
        variant: "destructive",
      });
      if (ok !== true) return;
      removeDraftStore(group!, id);
      if (id === activeId) selectNew();
    },
    [confirm, removeDraftStore, group, activeId, selectNew],
  );

  const discardActive = useCallback(() => {
    if (enabled && activeId) removeDraftStore(group!, activeId);
  }, [enabled, activeId, group, removeDraftStore]);

  const isNew = !activeId || !list.some((d) => d.id === activeId);
  const dirty =
    enabled && !opts.isEmpty?.(snapshot) && serialized !== lastSaved;

  return {
    enabled,
    mode,
    list,
    activeId,
    isNew,
    dirty,
    showSaveButton: enabled && mode === "manual",
    saveNow,
    selectNew,
    loadDraft,
    deleteDraft,
    discardActive,
  };
}
