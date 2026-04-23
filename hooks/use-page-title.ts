import { useEffect } from "react";
import { useTitleStore } from "@/lib/stores/title-store";

export function usePageTitle(title: string) {
  const setTitle = useTitleStore((s) => s.setTitle);
  useEffect(() => {
    setTitle(title);
  }, [title, setTitle]);
}
