import { create } from "zustand";

type LoadingState = {
  count: number;
  message: string;
  show: (message?: string) => void;
  hide: () => void;
  reset: () => void;
};

export const useLoadingStore = create<LoadingState>((set) => ({
  count: 1,
  message: "",
  show: (message = "") =>
    set((s) => ({
      count: s.count + 1,
      message: message || s.message || "Loading...",
    })),
  hide: () =>
    set((s) => {
      const next = Math.max(0, s.count - 1);
      return { count: next, message: next === 0 ? "" : s.message };
    }),
  reset: () => set({ count: 0, message: "" }),
}));
