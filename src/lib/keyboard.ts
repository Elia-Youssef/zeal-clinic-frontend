import type { KeyboardEvent } from "react";

/**
 * The keyboard half of a click handler on an element that isn't a native button (a table row, a
 * calendar cell): Enter or Space on the element itself runs `action`. Keys pressed on a control
 * inside it (a row's menu button, say) are left to that control.
 */
export function onActivateKey(action: () => void) {
  return (e: KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    action();
  };
}
