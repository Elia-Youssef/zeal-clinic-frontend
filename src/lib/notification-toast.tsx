import { toast } from "sonner";
import { Bell } from "lucide-react";

import type { Notification } from "@/lib/types";

export function showNotificationToast(notification: Notification): void {
  toast(notification.title, {
    icon: <Bell className="size-4 text-primary" />,
    position: "top-right",
    classNames: { title: "text-sm font-medium pointer-events-none" },
    duration: 1500,
  });
}
