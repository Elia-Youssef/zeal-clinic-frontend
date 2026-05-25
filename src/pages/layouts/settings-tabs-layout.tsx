import { usePageTitle } from "@/hooks/use-page-title";
import { RouteTabs } from "@/components/shared/route-tabs";

const tabs = [
  { label: "Staff", href: "/settings/staff", scopes: ["users:read"] },
  { label: "Roles", href: "/settings/roles", scopes: ["roles:read"] },
  {
    label: "Audit Log",
    href: "/settings/audit-log",
    scopes: ["audit:read"],
  },
  { label: "About", href: "/settings/about", scopes: ["update:read"] },
];

export default function SettingsTabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  usePageTitle("Settings");

  return (
    <div className="space-y-4">
      <RouteTabs tabs={tabs} />
      {children}
    </div>
  );
}
