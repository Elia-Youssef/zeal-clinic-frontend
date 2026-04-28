
import { usePageTitle } from "@/hooks/use-page-title";
import { RouteTabs } from "@/components/shared/route-tabs";

const tabs = [
  { label: "Forecast", href: "/reports/forecast", scopes: ["reports:read"] },
  { label: "P&L", href: "/reports/profit-loss", scopes: ["reports:read"] },
];

export default function ReportsTabsLayout({ children }: { children: React.ReactNode }) {
  usePageTitle("Reports");

  return (
    <div className="space-y-4">
      <RouteTabs tabs={tabs} />
      {children}
    </div>
  );
}
