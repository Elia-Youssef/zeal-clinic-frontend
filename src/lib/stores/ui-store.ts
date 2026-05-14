import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark";

const SCALE_MIN = 0.8;
const SCALE_MAX = 1.7;
const SCALE_DEFAULT = 1;

export const SCALE_BOUNDS = {
  min: SCALE_MIN,
  max: SCALE_MAX,
  step: 0.1,
  default: SCALE_DEFAULT,
};

type UIState = {
  theme: Theme;
  scale: number;
  sidebarOpen: boolean;
  toggleTheme: () => void;
  setScale: (scale: number) => void;
  setSidebarOpen: (open: boolean) => void;
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: "dark",
      scale: SCALE_DEFAULT,
      sidebarOpen: true,
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      setScale: (scale) =>
        set({ scale: Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale)) }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
    }),
    { name: "ui-settings" },
  ),
);

// Root font-size drives app scale through rem units.
function applyUiSettings(state: UIState): void {
  document.documentElement.classList.toggle("dark", state.theme === "dark");
  document.documentElement.style.fontSize = `${state.scale * 100}%`;
}

if (typeof window !== "undefined") {
  applyUiSettings(useUIStore.getState());
  useUIStore.subscribe(applyUiSettings);
}
