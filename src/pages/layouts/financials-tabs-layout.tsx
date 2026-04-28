
import { usePageTitle } from "@/hooks/use-page-title";
import { RouteTabs } from "@/components/shared/route-tabs";

const tabs = [
  { label: "Invoices", href: "/financials/invoices", scopes: ["transactions:read"] },
  { label: "Expenses", href: "/financials/expenses", scopes: ["transactions:read"] },
  { label: "Balances", href: "/financials/balances", scopes: ["transactions:read"] },
  { label: "Discounts", href: "/financials/discounts", scopes: ["services:read"] },
  { label: "Currencies", href: "/financials/currencies", scopes: ["transactions:read"] },
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
