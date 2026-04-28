/**
 * app-sidebar.tsx: Main sidebar navigation for the dashboard.
 * Theme toggle and logout live in the header avatar menu.
 */

import { Link } from "react-router-dom";
import { useLocation } from "react-router-dom";
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
  Truck,
} from "lucide-react";

import { usePermissions } from "@/hooks/use-permissions";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useAuthStore } from "@/lib/stores/auth-store";

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
      scopes: ["transactions:read", "services:read"],
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
  const { canAny } = usePermissions();
  const user = useAuthStore((s) => s.user);

  const visibleNavItems = Object.entries(navItems)
    .map(([group, items]) => ({
      group,
      items: items.filter(
        (item) => item.scopes.length === 0 || canAny(...item.scopes),
      ),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/dashboard" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <div
                  className="w-full h-full bg-no-repeat bg-center bg-cover"
                  style={{ backgroundImage: `url(/zeal.png)` }}
                />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Zeal Clinic</span>
                <span className="truncate text-xs text-muted-foreground">
                  {user}
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
            {group && (
              <SidebarGroupLabel className="pointer-events-none">
                {group}
              </SidebarGroupLabel>
            )}
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
    </Sidebar>
  );
}
