"use client";

import { usePageTitle } from "@/hooks/use-page-title";
import { RouteTabs } from "@/components/route-tabs";

const tabs = [
  { label: "Products", href: "/inventory/products" },
  { label: "Categories", href: "/inventory/categories" },
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
