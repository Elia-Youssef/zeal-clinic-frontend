import { create } from "zustand";

export type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  extraActionText?: string;
  extraActionVariant?: "default" | "destructive";
  variant?: "default" | "destructive";
};

export type ConfirmResult = boolean | "extra";

type ConfirmState = {
  open: boolean;
  options: ConfirmOptions;
  resolve: ((value: ConfirmResult) => void) | null;
  request: (options: ConfirmOptions) => Promise<ConfirmResult>;
  resolveWith: (value: ConfirmResult) => void;
};

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  options: {},
  resolve: null,
  request: (options) =>
    new Promise<ConfirmResult>((resolve) => {
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
