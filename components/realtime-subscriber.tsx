"use client";

import { useEffect } from "react";

import { BASE_URL } from "@/lib/api";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useNotificationsStore } from "@/lib/stores/notifications-store";
import { useAlertStore } from "@/lib/stores/alert-store";
import type { Notification } from "@/lib/types";

/**
 * Opens a single Server-Sent Events connection to /api/events for the
 * authenticated user. Mounted once per tab from DashboardWrapper.
 *
 * Renders nothing; it just manages the EventSource lifecycle.
 */
export function RealtimeSubscriber() {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const fetchUnreadCount = useNotificationsStore((s) => s.fetchUnreadCount);
  const addIncoming = useNotificationsStore((s) => s.addIncoming);
  const addAlert = useAlertStore((s) => s.addAlert);

  useEffect(() => {
    if (!token) return;

    const url = `${BASE_URL}/events?access_token=${encodeURIComponent(token)}`;
    const source = new EventSource(url);

    // `hello` fires once on connect: reconcile any events missed while
    // disconnected by refetching server-of-truth state.
    source.addEventListener("hello", () => {
      fetchUnreadCount().catch(() => {});
    });

    source.addEventListener("notification", (e: MessageEvent) => {
      try {
        const notification = JSON.parse(e.data) as Notification;
        addIncoming(notification);
        if (!notification.isRead) {
          addAlert("info", notification.title);
        }
      } catch {
        // Malformed payload: drop it and let the next hello reconcile.
      }
    });

    source.onerror = () => {
      // EventSource auto-reconnects on transient failures. A CLOSED state
      // means the browser has given up (typically a 401 from an expired
      // or revoked token), so bail out to the login screen.
      // if (source.readyState === EventSource.CLOSED) {
      //   source.close();
      //   logout();
      //   if (typeof window !== "undefined") {
      //     window.location.href = "/";
      //   }
      // }
    };

    return () => {
      source.close();
    };
  }, [token, fetchUnreadCount, addIncoming, addAlert, logout]);

  return null;
}
