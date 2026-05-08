
import { usePageTitle } from "@/hooks/use-page-title";
import { RouteTabs } from "@/components/shared/route-tabs";

const tabs = [
  { label: "Employees", href: "/team/employees", scopes: ["employees:read"] },
  { label: "Holidays", href: "/team/holidays", scopes: ["hr:read"] },
];

export default function TeamTabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  usePageTitle("Team");

  return (
    <div className="space-y-4">
      <RouteTabs tabs={tabs} />
      {children}
    </div>
  );
}
