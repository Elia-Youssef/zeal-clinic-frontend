import { useState } from "react";
import { useAdjustOnChange } from "@/hooks/use-adjust-on-change";

/**
 * Counts the times `open` has turned from false to true. A dialog whose state
 * must start fresh on every open keys the component holding that state by the
 * count: the key moves only when the dialog opens, so on close the same
 * content stays in place for the exit animation.
 */
export function useOpenCount(open: boolean): number {
  const [count, setCount] = useState(0);
  useAdjustOnChange([open], (previous) => {
    if (open && previous !== null) setCount((c) => c + 1);
  });
  return count;
}
