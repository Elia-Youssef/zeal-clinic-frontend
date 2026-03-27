"use client"

import { useState } from "react"
import {
  Search,
  Bell,
  Plus,
  UserPlus,
  CalendarPlus,
  FileText,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const quickActions = [
  { label: "New Patient", icon: UserPlus, href: "/patients/new" },
  { label: "New Appointment", icon: CalendarPlus, href: "/appointments/new" },
  { label: "New Invoice", icon: FileText, href: "/billing/new" },
]

// placeholder notifications
const notifications = [
  {
    id: "1",
    title: "Appointment Reminder",
    message: "Dr. Smith has 3 appointments remaining today.",
    time: "5 min ago",
    read: false,
  },
  {
    id: "2",
    title: "New Patient",
    message: "Maria Garcia has been registered.",
    time: "1 hour ago",
    read: false,
  },
  {
    id: "3",
    title: "Lab Results Ready",
    message: "Results for James Wilson are available.",
    time: "2 hours ago",
    read: true,
  },
]

export function AppHeader({ title }: { title: string }) {
  const [notifs, setNotifs] = useState(notifications)
  const unreadCount = notifs.filter((n) => !n.read).length

  const markAllRead = () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <h1 className="text-sm font-semibold">{title}</h1>

      <div className="ml-auto flex items-center gap-2">
        {/* Search */}
        <div className="relative hidden sm:block">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="h-8 w-48 pl-8 lg:w-64"
          />
        </div>

        {/* Quick Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="gap-1">
                <Plus className="size-4" />
                <span className="hidden sm:inline">Quick Action</span>
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            {quickActions.map((action) => (
              <DropdownMenuItem key={action.label}>
                <action.icon className="mr-2 size-4" />
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notifications */}
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="ghost" size="icon-sm" className="relative">
                <Bell className="size-4" />
                {unreadCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 size-4 items-center justify-center rounded-full p-0 text-[10px]">
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            }
          />
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <span className="text-sm font-semibold">Notifications</span>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-auto">
              {notifs.length === 0 ? (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  No notifications
                </p>
              ) : (
                notifs.map((notif) => (
                  <div
                    key={notif.id}
                    className={`flex gap-3 border-b px-4 py-3 last:border-0 ${
                      !notif.read ? "bg-muted/50" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{notif.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {notif.message}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground/70">
                        {notif.time}
                      </p>
                    </div>
                    {!notif.read && (
                      <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                ))
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  )
}
