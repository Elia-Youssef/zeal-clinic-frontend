import { useState } from "react";

/**
 * Runs `adjust` during render, on the first render and whenever `deps` change
 * (each entry compared with Object.is), so state that follows a prop is set
 * before the screen updates rather than one render later. This is the shape
 * React recommends for "adjusting some state when a prop changes": an effect
 * would paint the stale values first and re-render afterwards. `adjust` may
 * only set the calling component's own state, never a parent's; it receives
 * the previous `deps` (null on the first render).
 */
export function useAdjustOnChange(
  deps: readonly unknown[],
  adjust: (previous: readonly unknown[] | null) => void,
): void {
  const [previous, setPrevious] = useState<readonly unknown[] | null>(null);
  if (
    previous === null ||
    previous.length !== deps.length ||
    previous.some((value, index) => !Object.is(value, deps[index]))
  ) {
    setPrevious(deps);
    adjust(previous);
  }
}
