import type { KeyboardEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { onActivateKey } from "@/lib/keyboard";

/** A key event whose target is the element the handler sits on, unless `inner` says otherwise. */
function keyEvent(key: string, inner = false) {
  const element = {};
  const event = {
    key,
    currentTarget: element,
    target: inner ? {} : element,
    preventDefault: vi.fn(),
  };
  return event as unknown as KeyboardEvent<HTMLElement> & { preventDefault: ReturnType<typeof vi.fn> };
}

describe("onActivateKey", () => {
  it("runs the action on Enter and Space, and keeps Space from scrolling the page", () => {
    const action = vi.fn();
    const handler = onActivateKey(action);
    for (const key of ["Enter", " "]) {
      const event = keyEvent(key);
      handler(event);
      expect(event.preventDefault).toHaveBeenCalledOnce();
    }
    expect(action).toHaveBeenCalledTimes(2);
  });

  it("ignores other keys", () => {
    const action = vi.fn();
    const event = keyEvent("Tab");
    onActivateKey(action)(event);
    expect(action).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("leaves keys pressed on a control inside the element to that control", () => {
    const action = vi.fn();
    const event = keyEvent("Enter", true);
    onActivateKey(action)(event);
    expect(action).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
