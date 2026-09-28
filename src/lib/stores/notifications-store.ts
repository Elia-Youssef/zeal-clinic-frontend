import { create } from "zustand";
import { api, type Paginated } from "@/lib/api";
import type { Notification } from "@/lib/types";

type NotificationsState = {
  items: Notification[];
  unreadCount: number;
  loading: boolean;
  // Bumped each time an unread notification arrives in real time, so the bell
  // can animate on receipt without also firing on the initial load fetch.
  receivedNonce: number;
  // Whether the bell's panel shows the list, so a reload the server asks for
  // fetches the list only while someone can see it.
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  fetch: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  addIncoming: (notification: Notification) => void;
};

/** The store with nobody signed in: at start and after a sign-out. */
const SIGNED_OUT = {
  items: [] as Notification[],
  unreadCount: 0,
  loading: false,
  receivedNonce: 0,
  panelOpen: false,
};

export const useNotificationsStore = create<NotificationsState>((set, get) => ({
  ...SIGNED_OUT,

  setPanelOpen: (open) => set({ panelOpen: open }),

  fetch: async () => {
    set({ loading: true });
    try {
      const res = await api.get<Paginated<Notification>>("/notifications");
      set({ items: res.items });
      get().fetchUnreadCount().catch(() => {});
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
      const isUnread = !notification.isRead;
      return {
        items: [notification, ...state.items],
        unreadCount: state.unreadCount + (isUnread ? 1 : 0),
        receivedNonce: state.receivedNonce + (isUnread ? 1 : 0),
      };
    });
  },
}));

/** Drops the account's notifications and closes the bell's panel, the way a
 * sign-out does, so the next sign-in in this tab starts from nothing. */
export function clearNotifications(): void {
  useNotificationsStore.setState(SIGNED_OUT);
}
