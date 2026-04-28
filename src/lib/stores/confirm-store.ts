import { create } from "zustand";

export type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
};

type ConfirmState = {
  open: boolean;
  options: ConfirmOptions;
  resolve: ((value: boolean) => void) | null;
  request: (options: ConfirmOptions) => Promise<boolean>;
  resolveWith: (value: boolean) => void;
};

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  options: {},
  resolve: null,
  request: (options) =>
    new Promise<boolean>((resolve) => {
      const prev = get().resolve;
      if (prev) prev(false);
      set({ open: true, options, resolve });
    }),
  resolveWith: (value) => {
    const { resolve } = get();
    if (resolve) resolve(value);
    set({ open: false, resolve: null });
  },
}));
