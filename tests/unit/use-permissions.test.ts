// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuthStore } from "@/lib/stores/auth-store";

type Permissions = ReturnType<typeof usePermissions>;

function Probe({ onRender }: { onRender: (permissions: Permissions) => void }) {
  onRender(usePermissions());
  return null;
}

let root: Root | null = null;

// Renders the hook and returns a getter for its latest result.
async function renderPermissions(): Promise<() => Permissions> {
  const renders: Permissions[] = [];
  root = createRoot(document.createElement("div"));
  await act(async () => {
    root?.render(createElement(Probe, { onRender: (p) => renders.push(p) }));
  });
  return () => renders[renders.length - 1];
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

beforeEach(() => {
  useAuthStore.setState({ scopes: [] });
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
});

describe("usePermissions", () => {
  it("answers from the signed-in user's scopes", async () => {
    useAuthStore.setState({ scopes: ["patients:read", "patients:write"] });
    const permissions = await renderPermissions();
    const { can, canAny, canAll, scopes } = permissions();

    expect(scopes).toEqual(["patients:read", "patients:write"]);
    expect(can("patients:read")).toBe(true);
    expect(can("patients:delete")).toBe(false);
    expect(canAny("patients:delete", "patients:read")).toBe(true);
    expect(canAny("rooms:read", "rooms:write")).toBe(false);
    expect(canAll("patients:read", "patients:write")).toBe(true);
    expect(canAll("patients:read", "rooms:read")).toBe(false);
  });

  it("treats an empty list as nothing for canAny and everything for canAll", async () => {
    const permissions = await renderPermissions();
    expect(permissions().canAny()).toBe(false);
    expect(permissions().canAll()).toBe(true);
  });

  it("matches whole scope strings only", async () => {
    useAuthStore.setState({ scopes: ["patients:read"] });
    const permissions = await renderPermissions();
    expect(permissions().can("patients")).toBe(false);
    expect(permissions().can("PATIENTS:READ")).toBe(false);
    expect(permissions().can("patients:read ")).toBe(false);
  });

  it("re-renders with new answers when the store's scopes change", async () => {
    useAuthStore.setState({ scopes: ["rooms:read"] });
    const permissions = await renderPermissions();
    expect(permissions().can("rooms:read")).toBe(true);

    await act(async () => {
      useAuthStore.setState({ scopes: ["rooms:write"] });
    });
    expect(permissions().can("rooms:read")).toBe(false);
    expect(permissions().can("rooms:write")).toBe(true);

    await act(async () => {
      useAuthStore.getState().logout();
    });
    expect(permissions().scopes).toEqual([]);
    expect(permissions().canAny("rooms:write")).toBe(false);
  });
});
