import { create } from "zustand";

type TitleState = {
  /** The header title: the section or the record kind ("Patients", "Invoice"). */
  title: string;
  /** The label of the active route tab, when the page sits under one. */
  tab: string;
  setTitle: (title: string) => void;
  setTab: (tab: string) => void;
};

export const useTitleStore = create<TitleState>((set) => ({
  title: "",
  tab: "",
  setTitle: (title) => set({ title }),
  setTab: (tab) => set({ tab }),
}));

/** The browser tab's title: the most specific part first, then the app name. */
export function documentTitle(...parts: string[]): string {
  const named = parts.filter((part, i) => part && parts.indexOf(part) === i);
  return [...named, "Zeal Clinic"].join(" · ");
}
