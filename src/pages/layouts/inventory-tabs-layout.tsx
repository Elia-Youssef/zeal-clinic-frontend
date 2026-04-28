
import { usePageTitle } from "@/hooks/use-page-title";
import { RouteTabs } from "@/components/shared/route-tabs";

const tabs = [
  { label: "Products", href: "/inventory/products", scopes: ["inventory:read"] },
  { label: "Categories", href: "/inventory/categories", scopes: ["inventory:read"] },
];

export default function InventoryTabsLayout({ children }: { children: React.ReactNode }) {
  usePageTitle("Inventory");

  return (
    <div className="flex flex-col gap-4">
      <RouteTabs tabs={tabs} />
      {children}
    </div>
  );
}
