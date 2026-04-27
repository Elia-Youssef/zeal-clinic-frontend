"use client";

import { usePageTitle } from "@/hooks/use-page-title";
import { RouteTabs } from "@/components/shared/route-tabs";

const tabs = [
  { label: "Roles", href: "/settings/roles", scopes: ["roles:read"] },
  { label: "Users", href: "/settings/users", scopes: ["team:read"] },
  { label: "Audit Log", href: "/settings/audit-log", scopes: ["roles:read", "team:read"] },
  { label: "Connection", href: "/settings/connection", scopes: ["roles:read", "team:read"] },
];

export default function SettingsTabsLayout({ children }: { children: React.ReactNode }) {
  usePageTitle("Settings");

  return (
    <div className="space-y-4">
      <RouteTabs tabs={tabs} />
      {children}
    </div>
  );
}
