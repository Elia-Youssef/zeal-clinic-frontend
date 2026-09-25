import { beforeEach, describe, expect, it } from "vitest";
import { useNotificationsStore } from "@/lib/stores/notifications-store";
import type { Notification } from "@/lib/types";

function notification(id: string, isRead = false): Notification {
  return {
    id,
    title: `Notice ${id}`,
    description: "",
    isRead,
    createdAt: "2026-06-15T09:00:00Z",
  };
}

const store = () => useNotificationsStore.getState();

beforeEach(() => {
  useNotificationsStore.setState({ items: [], unreadCount: 0, receivedNonce: 0 });
});

describe("addIncoming", () => {
  it("puts new notifications first and counts the unread ones", () => {
    store().addIncoming(notification("n1"));
    store().addIncoming(notification("n2", true));
    store().addIncoming(notification("n3"));

    expect(store().items.map((n) => n.id)).toEqual(["n3", "n2", "n1"]);
    expect(store().unreadCount).toBe(2);
    expect(store().receivedNonce).toBe(2);
  });

  it("ignores a notification it already has, whatever its content", () => {
    store().addIncoming(notification("n1"));
    const before = useNotificationsStore.getState();

    store().addIncoming(notification("n1"));
    store().addIncoming({ ...notification("n1", true), title: "Changed" });

    expect(useNotificationsStore.getState()).toBe(before);
    expect(store().items).toHaveLength(1);
    expect(store().items[0].title).toBe("Notice n1");
    expect(store().unreadCount).toBe(1);
    expect(store().receivedNonce).toBe(1);
  });

  it("de-duplicates against notifications loaded earlier", () => {
    useNotificationsStore.setState({ items: [notification("n1", true)], unreadCount: 0 });
    store().addIncoming(notification("n1"));
    expect(store().items).toHaveLength(1);
    expect(store().unreadCount).toBe(0);
    expect(store().receivedNonce).toBe(0);
  });
});
