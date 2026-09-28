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
  Truck,
  Cable,
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
import { useSidebar } from "@/components/ui/use-sidebar";
import { ClinicLogo } from "@/components/shared/clinic-logo";
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
      scopes: ["suppliers:read"],
    },
    {
      title: "Financials",
      href: "/financials",
      icon: DollarSign,
      scopes: [
        "invoices:read",
        "expenses:read",
        "discounts:read",
        "currencies:read",
      ],
    },
    {
      title: "Team",
      href: "/team",
      icon: UsersRound,
      scopes: ["employees:read", "hr:read"],
    },
  ],
  Catalog: [
    {
      title: "Inventory",
      href: "/inventory",
      icon: Package,
      scopes: ["products:read", "product-categories:read"],
    },
    {
      title: "Services",
      href: "/services",
      icon: Briefcase,
      scopes: [
        "procedures:read",
        "procedure-types:read",
        "procedure-categories:read",
      ],
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
      scopes: ["roles:read", "users:read", "audit:read", "update:read"],
    },
    {
      title: "Connection",
      href: "/connection",
      icon: Cable,
      scopes: [],
    },
  ],
};

export function AppSidebar() {
  const { pathname } = useLocation();
  const { canAny } = usePermissions();
  const user = useAuthStore((s) => s.user);
  const { isMobile, setOpenMobile } = useSidebar();

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

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
      <SidebarHeader className="h-14 justify-center py-0">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link to="/dashboard" />}
              onClick={handleNavClick}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                {/* Decorative: the link's own text names the clinic. */}
                <ClinicLogo />
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

      <SidebarSeparator className="-mt-px mx-0" />

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
                      onClick={handleNavClick}
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
