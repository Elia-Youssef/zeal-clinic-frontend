import { create } from "zustand";

type LoadingState = {
  count: number;
  // Full-screen gate for boot/sign-out, separate from count.
  blocking: boolean;
  message: string;
  show: (message?: string) => void;
  hide: () => void;
  block: (message?: string) => void;
  unblock: () => void;
  reset: () => void;
};

export const useLoadingStore = create<LoadingState>((set) => ({
  count: 0,
  blocking: true,
  message: "Loading...",
  show: (message = "") =>
    set((s) => ({
      count: s.count + 1,
      message: message || s.message || "Loading...",
    })),
  hide: () =>
    set((s) => {
      const next = Math.max(0, s.count - 1);
      return {
        count: next,
        message: next === 0 && !s.blocking ? "" : s.message,
      };
    }),
  block: (message = "") =>
    set((s) => ({
      blocking: true,
      message: message || s.message || "Loading...",
    })),
  unblock: () =>
    set((s) => ({ blocking: false, message: s.count > 0 ? s.message : "" })),
  reset: () => set({ count: 0, blocking: false, message: "" }),
}));
