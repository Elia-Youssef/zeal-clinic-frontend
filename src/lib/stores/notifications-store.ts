import { create } from "zustand";
import { api, type Paginated } from "@/lib/api";
import type { Notification } from "@/lib/types";

type NotificationsState = {
  items: Notification[];
  unreadCount: number;
  loading: boolean;
  fetch: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  addIncoming: (notification: Notification) => void;
};

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  items: [],
  unreadCount: 0,
  loading: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const res = await api.get<Paginated<Notification>>("/notifications");
      set({ items: res.items });
    } finally {
      set({ loading: false });
    }
  },

  fetchUnreadCount: async () => {
    const count = await api.get<number>("/notifications/unread-count");
    set({ unreadCount: count });
  },

  markRead: async (id) => {
    await api.put(`/notifications/${id}/read`);
    set((state) => {
      const target = state.items.find((n) => n.id === id);
      const wasUnread = target ? !target.isRead : false;
      return {
        items: state.items.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
        unreadCount: Math.max(0, state.unreadCount - (wasUnread ? 1 : 0)),
      };
    });
  },

  markAllRead: async () => {
    await api.put("/notifications/read-all");
    set((state) => ({
      items: state.items.map((n) => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));
  },

  remove: async (id) => {
    await api.del(`/notifications/${id}`);
    const target = get().items.find((n) => n.id === id);
    const wasUnread = target ? !target.isRead : false;
    set((state) => ({
      items: state.items.filter((n) => n.id !== id),
      unreadCount: Math.max(0, state.unreadCount - (wasUnread ? 1 : 0)),
    }));
  },

  addIncoming: (notification) => {
    set((state) => {
      // SSE may deliver duplicates.
      if (state.items.some((n) => n.id === notification.id)) return state;
      return {
        items: [notification, ...state.items],
        unreadCount: state.unreadCount + (notification.isRead ? 0 : 1),
      };
    });
  },
}));
