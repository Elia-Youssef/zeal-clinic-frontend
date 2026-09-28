// @vitest-environment jsdom
import {
  act,
  createElement,
  type ComponentProps,
  type ReactElement,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { FormField } from "@/components/shared/form-field";

let root: Root | null = null;

function render(ui: ReactElement): HTMLElement {
  const host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => {
    root?.render(ui);
  });
  return host;
}

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  document.body.replaceChildren();
});

function field(
  props: Omit<ComponentProps<typeof FormField>, "children">,
  control: (ids: { id: string; labelId: string }) => ReactElement,
) {
  return createElement(FormField, { ...props, children: control });
}

describe("FormField", () => {
  it("links the label to the control it renders", () => {
    let handed: { id: string; labelId: string } | undefined;
    const host = render(
      field({ label: "First Name" }, (ids) => {
        handed = ids;
        return createElement("input", { id: ids.id });
      }),
    );
    const label = host.querySelector("label")!;
    const input = host.querySelector("input")!;
    expect(label.getAttribute("for")).toBe(input.id);
    expect(input.id).not.toBe("");
    expect(label.id).toBe(handed!.labelId);
  });

  it("leaves the label text alone without required", () => {
    const host = render(
      field({ label: "First Name" }, (ids) =>
        createElement("input", { id: ids.id }),
      ),
    );
    expect(host.querySelector("label")!.textContent).toBe("First Name");
  });

  it("names a group from the label's id in group mode", () => {
    const host = render(
      field({ label: "Date of Birth", group: true }, (ids) =>
        createElement("div", {
          role: "group",
          "aria-labelledby": ids.labelId,
        }),
      ),
    );
    const label = host.querySelector("label")!;
    expect(label.getAttribute("for")).toBe(null);
    const group = host.querySelector('[role="group"]')!;
    expect(group.getAttribute("aria-labelledby")).toBe(label.id);
    expect(label.id).not.toBe("");
  });

  it("appends the required mark to the label text", () => {
    const host = render(
      field({ label: "First Name", required: true }, (ids) =>
        createElement("input", { id: ids.id }),
      ),
    );
    expect(host.querySelector("label")!.textContent).toBe("First Name *");
  });

  it("styles the small variant's label as the muted label", () => {
    const host = render(
      field({ label: "From", size: "small" }, (ids) =>
        createElement("input", { id: ids.id }),
      ),
    );
    expect(host.querySelector("label")!.className).toBe(
      "text-xs font-medium text-muted-foreground",
    );
  });

  it("styles the muted variant's label as the quieter row label", () => {
    const host = render(
      field({ label: "Qty", size: "muted" }, (ids) =>
        createElement("input", { id: ids.id }),
      ),
    );
    expect(host.querySelector("label")!.className).toBe(
      "text-xs text-muted-foreground",
    );
  });

  it("puts actions beside the label and passes wrapper classes through", () => {
    const host = render(
      field(
        {
          label: "Invoice Number",
          required: true,
          className: "space-y-2",
          actions: createElement("span", null, "Auto"),
        },
        (ids) => createElement("input", { id: ids.id }),
      ),
    );
    const wrapper = host.querySelector("div")!;
    // The caller's spacing replaces the default, and the label and the
    // actions share one line.
    expect(wrapper.className).toBe("space-y-2");
    const row = wrapper.querySelector("div")!;
    expect(row.className).toBe("flex items-center justify-between");
    expect(row.querySelector("label")!.textContent).toBe("Invoice Number *");
    expect(row.querySelector("span")!.textContent).toBe("Auto");
  });
});
