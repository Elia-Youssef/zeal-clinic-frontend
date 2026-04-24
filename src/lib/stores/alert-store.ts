import { create } from "zustand";
import { toast } from "sonner";

export type AlertType = "success" | "error" | "warning" | "info";

type AlertState = {
  addAlert: (type: AlertType, message: string) => void;
};

export const useAlertStore = create<AlertState>(() => ({
  addAlert: (type, message) => {
    switch (type) {
      case "success":
        toast.success(message);
        return;
      case "error":
        toast.error(message);
        return;
      case "warning":
        toast.warning(message);
        return;
      case "info":
        toast.info(message);
        return;
    }
  },
}));
