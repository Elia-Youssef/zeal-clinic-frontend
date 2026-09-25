// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

// The module applies the saved theme and scale when it is imported, so each
// test loads a fresh copy.
async function loadUiStore() {
  vi.resetModules();
  return import("@/lib/stores/ui-store");
}

const root = () => document.documentElement;

function savedSettings(): unknown {
  return JSON.parse(localStorage.getItem("ui-settings") ?? "null");
}

beforeEach(() => {
  localStorage.clear();
  root().className = "";
  root().style.fontSize = "";
});

describe("ui store", () => {
  it("applies the dark theme at 100% on import when nothing is saved", async () => {
    const { useUIStore } = await loadUiStore();
    expect(useUIStore.getState()).toMatchObject({ theme: "dark", scale: 1, sidebarOpen: true });
    expect(root().classList.contains("dark")).toBe(true);
    expect(root().style.fontSize).toBe("100%");
  });

  it("applies saved settings on import", async () => {
    localStorage.setItem(
      "ui-settings",
      JSON.stringify({ state: { theme: "light", scale: 1.3, sidebarOpen: false }, version: 0 }),
    );
    const { useUIStore } = await loadUiStore();
    expect(useUIStore.getState()).toMatchObject({ theme: "light", scale: 1.3, sidebarOpen: false });
    expect(root().classList.contains("dark")).toBe(false);
    expect(root().style.fontSize).toBe("130%");
  });

  it("toggles the dark class on the root element", async () => {
    const { useUIStore } = await loadUiStore();
    useUIStore.getState().toggleTheme();
    expect(useUIStore.getState().theme).toBe("light");
    expect(root().classList.contains("dark")).toBe(false);
    useUIStore.getState().toggleTheme();
    expect(root().classList.contains("dark")).toBe(true);
  });

  it("clamps the scale to 0.8-1.7 and sizes the root font with it", async () => {
    const { useUIStore, SCALE_BOUNDS } = await loadUiStore();
    expect(SCALE_BOUNDS).toEqual({ min: 0.8, max: 1.7, step: 0.1, default: 1 });

    useUIStore.getState().setScale(2);
    expect(useUIStore.getState().scale).toBe(1.7);
    expect(root().style.fontSize).toBe("170%");

    useUIStore.getState().setScale(0.5);
    expect(useUIStore.getState().scale).toBe(0.8);
    expect(root().style.fontSize).toBe("80%");

    useUIStore.getState().setScale(1.25);
    expect(root().style.fontSize).toBe("125%");
  });

  it("persists theme, scale and sidebar state as ui-settings", async () => {
    const { useUIStore } = await loadUiStore();
    useUIStore.getState().toggleTheme();
    useUIStore.getState().setScale(1.5);
    useUIStore.getState().setSidebarOpen(false);
    expect(savedSettings()).toEqual({
      state: { theme: "light", scale: 1.5, sidebarOpen: false },
      version: 0,
    });
  });
});
