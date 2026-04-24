"use client";

import { usePageTitle } from "@/hooks/use-page-title";
import { RouteTabs } from "@/components/shared/route-tabs";

const tabs = [
  { label: "Roles", href: "/settings/roles" },
  { label: "Users", href: "/settings/users" },
  { label: "Audit Log", href: "/settings/audit-log" },
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
