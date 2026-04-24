import { create } from "zustand";

type TitleState = {
  title: string;
  setTitle: (title: string) => void;
};

export const useTitleStore = create<TitleState>((set) => ({
  title: "",
  setTitle: (title) => set({ title }),
}));
