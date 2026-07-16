import { create } from "zustand";
import { persist } from "zustand/middleware";

// localStorage-backed store for unsaved form drafts. Drafts are grouped by a
// namespace (e.g. "client-invoice"), each addressed by its own id. Forms drive
// this through the useFormDrafts hook rather than calling it directly.

export type FormDraft<T = unknown> = {
  id: string;
  label: string;
  data: T;
  updatedAt: string;
};

type FormDraftsState = {
  drafts: Record<string, FormDraft[]>;
  saveDraft: <T>(
    group: string,
    draft: { id: string; label: string; data: T },
  ) => void;
  getDraft: <T>(group: string, id: string) => FormDraft<T> | undefined;
  removeDraft: (group: string, id: string) => void;
};

export const useFormDraftsStore = create<FormDraftsState>()(
  persist(
    (set, get) => ({
      drafts: {},

      saveDraft: (group, draft) =>
        set((s) => {
          const existing = s.drafts[group] ?? [];
          const entry: FormDraft = {
            ...draft,
            updatedAt: new Date().toISOString(),
          };
          const idx = existing.findIndex((d) => d.id === draft.id);
          const list =
            idx === -1
              ? [entry, ...existing]
              : existing.map((d, i) => (i === idx ? entry : d));
          return { drafts: { ...s.drafts, [group]: list } };
        }),

      getDraft: <T>(group: string, id: string) =>
        get().drafts[group]?.find((d) => d.id === id) as
          | FormDraft<T>
          | undefined,

      removeDraft: (group, id) =>
        set((s) => {
          const existing = s.drafts[group];
          if (!existing) return s;
          const list = existing.filter((d) => d.id !== id);
          const drafts = { ...s.drafts };
          if (list.length) drafts[group] = list;
          else delete drafts[group];
          return { drafts };
        }),
    }),
    {
      name: "form-drafts",
      partialize: (s) => ({ drafts: s.drafts }),
    },
  ),
);

/** Clear draft state and its persisted localStorage entry without touching
 * other locally persisted user preferences. */
export function clearFormDrafts(): void {
  useFormDraftsStore.setState({ drafts: {} });
  useFormDraftsStore.persist.clearStorage();
}

// Stable ref so the selector never returns a fresh array (avoids re-render loops).
const EMPTY: FormDraft[] = [];

// Reactive draft list for a group. Returns the stored array as-is; sort/derive
// in the consumer to keep renders stable.
export function useDraftGroup<T>(group: string | undefined): FormDraft<T>[] {
  return useFormDraftsStore(
    (s) => (group && s.drafts[group]) || EMPTY,
  ) as FormDraft<T>[];
}
