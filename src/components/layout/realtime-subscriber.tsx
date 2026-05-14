import { useEffect } from "react";

import { realtimeClient } from "@/lib/realtime/realtime-client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useNotificationsStore } from "@/lib/stores/notifications-store";
import { useAlertStore } from "@/lib/stores/alert-store";
import { useLoadingStore } from "@/lib/stores/loading-store";
import { useRealtimeStore } from "@/lib/stores/realtime-store";
import type { Notification } from "@/lib/types";

export function RealtimeSubscriber() {
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    const { fetchUnreadCount, addIncoming } = useNotificationsStore.getState();
    const { addAlert } = useAlertStore.getState();
    const { setConnected, setCloudConnected } = useRealtimeStore.getState();
    const { refreshAuth } = useAuthStore.getState();

    realtimeClient.setListeners({
      onOpen: () => setConnected(true),
      onError: () => setConnected(false),
      onEvent: {
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
            // Next hello reconciles missed notifications.
          }
        },
        scopes_changed: () => {
          const loading = useLoadingStore.getState();
          loading.show("Updating permissions...");
          refreshAuth()
            .catch(() => {})
            .finally(() => {
              // Let scope redirects settle before hiding.
              setTimeout(() => loading.hide(), 50);
            });
        },
        data_changed: () => {
          addAlert("info", "Syncing completed.");
        },
        cloud_connection: (e) => {
          try {
            const connected = JSON.parse(e.data) as unknown;
            if (typeof connected === "boolean") {
              setCloudConnected(connected);
            }
          } catch {
            // Keep the previous cloud state.
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
