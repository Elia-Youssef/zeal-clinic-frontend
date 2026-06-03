import { create } from "zustand";
import { toast } from "sonner";

export type AlertType = "success" | "error" | "warning" | "info";

type AlertState = {
  // `id` dedupes repeated toasts (e.g. a burst of 403s) into a single message.
  addAlert: (type: AlertType, message: string, id?: string) => void;
};

export const useAlertStore = create<AlertState>(() => ({
  addAlert: (type, message, id) => {
    const opts = id ? { id } : undefined;
    switch (type) {
      case "success":
        toast.success(message, opts);
        return;
      case "error":
        toast.error(message, opts);
        return;
      case "warning":
        toast.warning(message, opts);
        return;
      case "info":
        toast.info(message, opts);
        return;
    }
  },
}));
