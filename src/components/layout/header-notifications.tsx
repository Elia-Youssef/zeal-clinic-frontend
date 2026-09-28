import { useEffect, useId, useRef, useState } from "react";
import { motion, useAnimationControls } from "motion/react";
import { Bell, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotificationsStore } from "@/lib/stores/notifications-store";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import { formatInBeirut } from "@/lib/tz";
import type { Notification } from "@/lib/types";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.floor((Date.now() - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatInBeirut(iso, "yyyy-MM-dd");
}

export function HeaderNotifications() {
  const [open, setOpen] = useState(false);
  const items = useNotificationsStore((s) => s.items);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const receivedNonce = useNotificationsStore((s) => s.receivedNonce);
  const fetchList = useNotificationsStore((s) => s.fetch);
  const fetchUnreadCount = useNotificationsStore((s) => s.fetchUnreadCount);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const remove = useNotificationsStore((s) => s.remove);
  const addAlert = useAlertStore((s) => s.addAlert);

  const bellControls = useAnimationControls();
  const badgeControls = useAnimationControls();
  const firstRender = useRef(true);

  useEffect(() => {
    fetchUnreadCount().catch(() => {});
  }, [fetchUnreadCount]);

  // Swing the bell and pop the badge whenever a new notification arrives.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    bellControls.start({
      rotate: [0, -16, 13, -10, 7, -3, 0],
      transition: { duration: 0.7, ease: "easeInOut" },
    });
    badgeControls.start({
      scale: [1, 1.5, 0.9, 1.15, 1],
      transition: { duration: 0.5, ease: "easeOut" },
    });
  }, [receivedNonce, bellControls, badgeControls]);

  useEffect(() => {
    if (!open) return;
    fetchList().catch((err) => addAlert("error", getErrorMessage(err)));
  }, [open, fetchList, addAlert]);

  const handleItemClick = async (id: string, read: boolean) => {
    if (read) return;
    try {
      await markRead(id);
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await remove(id);
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="secondary"
            size="icon-sm"
            className="relative"
            aria-label={
              unreadCount > 0
                ? `Notifications, ${unreadCount} unread`
                : "Notifications"
            }
          >
            <motion.span
              animate={bellControls}
              style={{ display: "inline-flex", transformOrigin: "50% 0%" }}
            >
              <Bell className="size-4" />
            </motion.span>
            {unreadCount > 0 && (
              <motion.span
                animate={badgeControls}
                className="absolute -top-1 -right-1"
              >
                <Badge className="size-4 items-center justify-center rounded-full p-0 text-[10px]">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Badge>
              </motion.span>
            )}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80 p-0 gap-0 overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <span className="text-sm font-semibold">Notifications</span>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Mark all read
              </button>
            )}
          </div>
        </div>
        <div className="max-h-72 overflow-auto no-scrollbar">
          {items.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No notifications
            </p>
          ) : (
            <ul>
              {items.map((notif) => (
                <NotificationItem
                  key={notif.id}
                  notification={notif}
                  onOpen={() => handleItemClick(notif.id, notif.isRead)}
                  onRemove={() => handleRemove(notif.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * One notification in the bell's list. Its body stays a rendered button in
 * both states, so marking it read from the keyboard keeps the focus on it;
 * only its name and styling change. The button is named by the title (plus
 * "Unread" while unread) and described by the text and the time; the delete
 * button sits beside it.
 */
function NotificationItem({
  notification,
  onOpen,
  onRemove,
}: {
  notification: Notification;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const id = useId();
  return (
    <li
      className={`group flex gap-3 border-b pl-4 pr-2 py-3 border-r-4 hover:bg-muted/30 ${
        !notification.isRead
          ? "bg-muted/50 border-r-primary"
          : "border-r-transparent"
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-labelledby={`${id}-name`}
        aria-describedby={`${id}-description ${id}-time`}
        className="flex-1 min-w-0 cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span id={`${id}-name`} className="block text-sm font-medium">
          {notification.title}
          {!notification.isRead && <span className="sr-only">Unread</span>}
        </span>
        <span
          id={`${id}-description`}
          className="block text-xs text-muted-foreground"
        >
          {notification.description}
        </span>
        <span
          id={`${id}-time`}
          className="mt-1 block text-xs text-muted-foreground/70"
        >
          {timeAgo(notification.createdAt)}
        </span>
      </button>
      <div className="flex flex-col items-end gap-1 justify-between">
        <button
          type="button"
          onClick={onRemove}
          className="cursor-pointer text-muted-foreground opacity-0 transition hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
          aria-label="Delete notification"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </li>
  );
}
