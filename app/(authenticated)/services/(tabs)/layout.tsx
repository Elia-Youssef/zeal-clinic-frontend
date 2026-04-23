"use client";

import { usePageTitle } from "@/hooks/use-page-title";
import { RouteTabs } from "@/components/route-tabs";

const tabs = [
  { label: "Procedures", href: "/services/procedures" },
  { label: "Types", href: "/services/types" },
  { label: "Categories", href: "/services/categories" },
];

export default function ServicesTabsLayout({ children }: { children: React.ReactNode }) {
  usePageTitle("Services");

  return (
    <div className="space-y-4">
      <RouteTabs tabs={tabs} />
      {children}
    </div>
  );
}
