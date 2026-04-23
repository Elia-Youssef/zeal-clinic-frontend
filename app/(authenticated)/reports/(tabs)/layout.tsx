"use client";

import { usePageTitle } from "@/hooks/use-page-title";
import { RouteTabs } from "@/components/route-tabs";

const tabs = [
  { label: "Forecast", href: "/reports/forecast" },
  { label: "P&L", href: "/reports/profit-loss" },
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
