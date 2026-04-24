"use client";

import { usePageTitle } from "@/hooks/use-page-title";
import { RouteTabs } from "@/components/shared/route-tabs";

const tabs = [
  { label: "Invoices", href: "/financials/invoices" },
  { label: "Balances", href: "/financials/balances" },
  { label: "Adjustments", href: "/financials/adjustments" },
  { label: "Discounts", href: "/financials/discounts" },
  { label: "Currencies", href: "/financials/currencies" },
];

export default function FinancialsTabsLayout({ children }: { children: React.ReactNode }) {
  usePageTitle("Financials");

  return (
    <div className="space-y-4">
      <RouteTabs tabs={tabs} />
      {children}
    </div>
  );
}
