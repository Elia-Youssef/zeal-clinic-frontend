import { create } from "zustand";
import { persist } from "zustand/middleware";

type DashboardLayoutState = {
  hidden: string[];
  toggleHidden: (id: string) => void;
  reset: () => void;
};

export const useDashboardStore = create<DashboardLayoutState>()(
  persist(
    (set) => ({
      hidden: [],
      toggleHidden: (id) =>
        set((s) => ({
          hidden: s.hidden.includes(id)
            ? s.hidden.filter((h) => h !== id)
            : [...s.hidden, id],
        })),
      reset: () => set({ hidden: [] }),
    }),
    { name: "dashboard-layout" },
  ),
);
