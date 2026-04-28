import { useConfirmStore, type ConfirmOptions } from "@/lib/stores/confirm-store";

export function useConfirm() {
  const request = useConfirmStore((s) => s.request);
  return (options: ConfirmOptions | string) =>
    request(typeof options === "string" ? { description: options } : options);
}
