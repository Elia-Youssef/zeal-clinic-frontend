
import { useEffect, useState } from "react";
import { Bell, Trash2, X } from "lucide-react";

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

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Math.floor((Date.now() - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function HeaderNotifications() {
  const [open, setOpen] = useState(false);
  const items = useNotificationsStore((s) => s.items);
  const unreadCount = useNotificationsStore((s) => s.unreadCount);
  const fetchList = useNotificationsStore((s) => s.fetch);
  const fetchUnreadCount = useNotificationsStore((s) => s.fetchUnreadCount);
  const markRead = useNotificationsStore((s) => s.markRead);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const remove = useNotificationsStore((s) => s.remove);
  const addAlert = useAlertStore((s) => s.addAlert);

  useEffect(() => {
    fetchUnreadCount().catch(() => {});
  }, [fetchUnreadCount]);

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

  const handleRemove = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
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
          <Button variant="secondary" size="icon-sm" className="relative">
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-1 -right-1 size-4 items-center justify-center rounded-full p-0 text-[10px]">
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80 p-0 gap-0">
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
        <div className="max-h-72 overflow-auto">
          {items.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No notifications
            </p>
          ) : (
            items.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleItemClick(notif.id, notif.isRead)}
                className={`group flex cursor-pointer gap-3 border-b pl-4 pr-2 py-3 hover:bg-muted/30 border-r-4 ${
                  !notif.isRead
                    ? "bg-muted/50 border-r-primary"
                    : "border-r-transparent"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{notif.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {notif.description}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    {timeAgo(notif.createdAt)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 justify-between">
                  <button
                    onClick={(e) => handleRemove(e, notif.id)}
                    className="text-muted-foreground opacity-0 transition hover:text-foreground group-hover:opacity-100"
                    aria-label="Delete notification"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
