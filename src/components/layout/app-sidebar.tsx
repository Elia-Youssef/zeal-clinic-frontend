/**
 * app-sidebar.tsx: Main sidebar navigation for the dashboard.
 * Contains nav links, theme toggle, and logout button.
 * Logout calls POST /api/auth/logout then clears localStorage.
 */
"use client";

import { Link } from "react-router-dom";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  DollarSign,
  Package,
  Briefcase,
  UsersRound,
  BarChart3,
  Settings,
  Activity,
  LogOut,
  Sun,
  Moon,
  Truck,
} from "lucide-react";

import { useTheme } from "@/contexts/theme-context";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usePermissions } from "@/hooks/use-permissions";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

const navItems = {
  "": [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
      scopes: [],
    },
  ],
  Clinical: [
    {
      title: "Schedule",
      href: "/schedule",
      icon: CalendarDays,
      scopes: ["appointments:read", "rooms:read"],
    },
    {
      title: "Patients",
      href: "/patients",
      icon: Users,
      scopes: ["patients:read"],
    },
  ],
  Business: [
    {
      title: "Suppliers",
      href: "/suppliers",
      icon: Truck,
      scopes: ["inventory:read"],
    },
    {
      title: "Financials",
      href: "/financials",
      icon: DollarSign,
      scopes: ["transactions:read"],
    },
    {
      title: "Team",
      href: "/team",
      icon: UsersRound,
      scopes: ["team:read"],
    },
  ],
  Catalog: [
    {
      title: "Inventory",
      href: "/inventory",
      icon: Package,
      scopes: ["inventory:read"],
    },
    {
      title: "Services",
      href: "/services",
      icon: Briefcase,
      scopes: ["services:read"],
    },
  ],
  System: [
    {
      title: "Reports",
      href: "/reports",
      icon: BarChart3,
      scopes: ["reports:read"],
    },
    {
      title: "Settings",
      href: "/settings",
      icon: Settings,
      scopes: ["roles:read", "team:read"],
    },
  ],
};

export function AppSidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { canAny } = usePermissions();

  const logout = useAuthStore((s) => s.logout);

  const visibleNavItems = Object.entries(navItems)
    .map(([group, items]) => ({
      group,
      items: items.filter(
        (item) => item.scopes.length === 0 || canAny(...item.scopes),
      ),
    }))
    .filter((g) => g.items.length > 0);

  /** Tell the backend to invalidate the session, then clear local state. */
  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* Even if the call fails we still clear locally so the user can log out */
    }
    logout();
    navigate("/");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/dashboard" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Activity className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Clinic</span>
                <span className="truncate text-xs text-muted-foreground">
                  Management
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator className="mx-0" />

      <SidebarContent>
        {visibleNavItems.map(({ group, items }) => (
          <SidebarGroup key={group}>
            {group && <SidebarGroupLabel>{group}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu className="flex flex-col gap-1">
                {items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      isActive={pathname.startsWith(item.href)}
                      tooltip={item.title}
                      render={<Link to={item.href} />}
                      className={
                        pathname.startsWith(item.href) ? "" : "hover:bg-muted"
                      }
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarSeparator className="mx-0" />

      <SidebarFooter>
        <SidebarMenu className="text-muted-foreground text-sm">
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleTheme}
              tooltip={
                theme === "light"
                  ? "Switch to dark mode"
                  : "Switch to light mode"
              }
            >
              {theme === "light" ? <Moon /> : <Sun />}
              <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} tooltip="Logout">
              <LogOut />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
