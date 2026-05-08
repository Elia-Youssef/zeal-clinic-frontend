
import { usePageTitle } from "@/hooks/use-page-title";
import { RouteTabs } from "@/components/shared/route-tabs";

const tabs = [
  { label: "Procedures", href: "/services/procedures", scopes: ["procedures:read"] },
  { label: "Types", href: "/services/types", scopes: ["procedure-types:read"] },
  { label: "Categories", href: "/services/categories", scopes: ["procedure-categories:read"] },
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
