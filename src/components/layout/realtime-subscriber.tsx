import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { realtimeClient } from "@/lib/realtime/realtime-client";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useNotificationsStore } from "@/lib/stores/notifications-store";
import { useAlertStore } from "@/lib/stores/alert-store";
import { useLoadingStore } from "@/lib/stores/loading-store";
import { useRealtimeStore } from "@/lib/stores/realtime-store";
import { showNotificationToast } from "@/lib/notification-toast";
import { isCloudRestoreProgressEvent } from "@/lib/cloud-restore-progress";
import type { Notification } from "@/lib/types";

export function RealtimeSubscriber() {
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    const { fetchUnreadCount, addIncoming } = useNotificationsStore.getState();
    const { addAlert } = useAlertStore.getState();
    const {
      setConnected,
      setCloudConnected,
      setCloudRestoreProgress,
    } = useRealtimeStore.getState();
    const { refreshAuth, logout } = useAuthStore.getState();

    realtimeClient.setListeners({
      onOpen: () => {
        setConnected(true);
        // The backend sends its authoritative restore state on every connect.
        setCloudRestoreProgress(null);
      },
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
              showNotificationToast(notification);
            }
          } catch {
            // Next hello reconciles missed notifications.
          }
        },
        scopes_changed: () => {
          const loading = useLoadingStore.getState();
          loading.show("Updating permissions");
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
        account_disabled: () => {
          logout();
          navigateRef.current("/", { replace: true });
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
        cloud_restore_progress: (e) => {
          try {
            const progress = JSON.parse(e.data) as unknown;
            if (isCloudRestoreProgressEvent(progress)) {
              setCloudRestoreProgress(progress);
            }
          } catch {
            // Ignore malformed progress events and keep the previous state.
          }
        },
      },
    });

    realtimeClient.start(token);
    const handleOnline = () => realtimeClient.reconnect();
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
      realtimeClient.stop();
    };
  }, [token]);

  return null;
}
