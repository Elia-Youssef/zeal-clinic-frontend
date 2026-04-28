
import { useEffect } from "react";

import { realtimeClient } from "@/lib/realtime/realtime-client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useNotificationsStore } from "@/lib/stores/notifications-store";
import { useAlertStore } from "@/lib/stores/alert-store";
import { useRealtimeStore } from "@/lib/stores/realtime-store";
import type { Notification } from "@/lib/types";

/**
 * Wires the singleton realtime client to the auth token and the relevant
 * stores. Mounted once per tab from DashboardWrapper. Renders nothing.
 */
export function RealtimeSubscriber() {
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    const { fetchUnreadCount, addIncoming } = useNotificationsStore.getState();
    const { addAlert } = useAlertStore.getState();
    const { setConnected } = useRealtimeStore.getState();

    realtimeClient.setListeners({
      onOpen: () => setConnected(true),
      onError: () => setConnected(false),
      onEvent: {
        // `hello` fires once per connection: reconcile any events missed
        // while disconnected by refetching server-of-truth state.
        hello: () => {
          setConnected(true);
          fetchUnreadCount().catch(() => {});
        },
        notification: (e) => {
          try {
            const notification = JSON.parse(e.data) as Notification;
            addIncoming(notification);
            if (!notification.isRead) {
              addAlert("info", notification.title);
            }
          } catch {
            // Malformed payload: drop it and let the next hello reconcile.
          }
        },
      },
    });

    realtimeClient.start(token);

    return () => {
      realtimeClient.stop();
    };
  }, [token]);

  return null;
}
