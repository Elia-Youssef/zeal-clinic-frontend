
import { usePageTitle } from "@/hooks/use-page-title";
import { RouteTabs } from "@/components/shared/route-tabs";

const tabs = [
  { label: "Invoices", href: "/financials/invoices", scopes: ["invoices:read"] },
  { label: "Expenses", href: "/financials/expenses", scopes: ["expenses:read"] },
  // { label: "Balances", href: "/financials/balances", scopes: ["balances:read"] },
  { label: "Discounts", href: "/financials/discounts", scopes: ["discounts:read"] },
  { label: "Currencies", href: "/financials/currencies", scopes: ["currencies:read"] },
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
