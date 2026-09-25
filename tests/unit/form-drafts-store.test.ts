// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearFormDrafts, useFormDraftsStore } from "@/lib/stores/form-drafts-store";

// Drafts deliberately live in localStorage until logout.

const store = () => useFormDraftsStore.getState();

function persisted(): unknown {
  const raw = localStorage.getItem("form-drafts");
  return raw === null ? null : JSON.parse(raw);
}

beforeEach(() => {
  useFormDraftsStore.setState({ drafts: {} });
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("saveDraft", () => {
  it("adds new drafts at the front of their group with a timestamp", () => {
    vi.setSystemTime("2026-06-15T09:00:00.000Z");
    store().saveDraft("patient", { id: "a", label: "First", data: { name: "First" } });
    vi.setSystemTime("2026-06-15T09:05:00.000Z");
    store().saveDraft("patient", { id: "b", label: "Second", data: { name: "Second" } });

    expect(store().drafts.patient).toEqual([
      { id: "b", label: "Second", data: { name: "Second" }, updatedAt: "2026-06-15T09:05:00.000Z" },
      { id: "a", label: "First", data: { name: "First" }, updatedAt: "2026-06-15T09:00:00.000Z" },
    ]);
  });

  it("replaces an existing draft where it is", () => {
    vi.setSystemTime("2026-06-15T09:00:00.000Z");
    store().saveDraft("patient", { id: "a", label: "First", data: { step: 1 } });
    store().saveDraft("patient", { id: "b", label: "Second", data: { step: 1 } });
    vi.setSystemTime("2026-06-15T10:00:00.000Z");
    store().saveDraft("patient", { id: "a", label: "First, edited", data: { step: 2 } });

    expect(store().drafts.patient).toEqual([
      { id: "b", label: "Second", data: { step: 1 }, updatedAt: "2026-06-15T09:00:00.000Z" },
      { id: "a", label: "First, edited", data: { step: 2 }, updatedAt: "2026-06-15T10:00:00.000Z" },
    ]);
  });

  it("keeps groups apart", () => {
    store().saveDraft("patient", { id: "a", label: "Patient", data: {} });
    store().saveDraft("client-invoice", { id: "a", label: "Invoice", data: {} });
    expect(Object.keys(store().drafts).sort()).toEqual(["client-invoice", "patient"]);
    expect(store().getDraft("patient", "a")?.label).toBe("Patient");
    expect(store().getDraft("client-invoice", "a")?.label).toBe("Invoice");
    expect(store().getDraft("patient", "missing")).toBeUndefined();
    expect(store().getDraft("missing", "a")).toBeUndefined();
  });
});

describe("removeDraft", () => {
  it("removes one draft and drops the group when it empties", () => {
    store().saveDraft("patient", { id: "a", label: "A", data: {} });
    store().saveDraft("patient", { id: "b", label: "B", data: {} });

    store().removeDraft("patient", "a");
    expect(store().drafts.patient.map((d) => d.id)).toEqual(["b"]);

    store().removeDraft("patient", "b");
    expect(store().drafts).toEqual({});
    expect("patient" in store().drafts).toBe(false);
  });

  it("leaves the state untouched for an unknown group", () => {
    store().saveDraft("patient", { id: "a", label: "A", data: {} });
    const before = store().drafts;
    store().removeDraft("missing", "a");
    expect(store().drafts).toBe(before);
  });
});

describe("persistence", () => {
  it("stores only the drafts under form-drafts in localStorage", () => {
    vi.setSystemTime("2026-06-15T09:00:00.000Z");
    store().saveDraft("patient", { id: "a", label: "A", data: { name: "Test Patient" } });

    expect(persisted()).toEqual({
      state: {
        drafts: {
          patient: [
            { id: "a", label: "A", data: { name: "Test Patient" }, updatedAt: "2026-06-15T09:00:00.000Z" },
          ],
        },
      },
      version: 0,
    });
    expect(sessionStorage.length).toBe(0);
  });

  it("brings the drafts back after a reload", async () => {
    store().saveDraft("patient", { id: "a", label: "A", data: { name: "Test Patient" } });
    const saved = store().drafts;

    vi.resetModules();
    const reloaded = await import("@/lib/stores/form-drafts-store");

    expect(reloaded.useFormDraftsStore).not.toBe(useFormDraftsStore);
    expect(reloaded.useFormDraftsStore.getState().drafts).toEqual(saved);
  });

  it("clearFormDrafts empties the store and removes only its own key", () => {
    localStorage.setItem("ui-settings", "{}");
    store().saveDraft("patient", { id: "a", label: "A", data: {} });

    clearFormDrafts();

    expect(store().drafts).toEqual({});
    expect(localStorage.getItem("form-drafts")).toBeNull();
    expect(localStorage.getItem("ui-settings")).toBe("{}");
  });
});
