import { usePageTitle } from "@/hooks/use-page-title";
import { RouteTabs } from "@/components/shared/route-tabs";

const tabs = [
  { label: "Calendar", href: "/schedule/calendar", scopes: ["appointments:read"] },
  { label: "Rooms", href: "/schedule/rooms", scopes: ["rooms:read"] },
];

export default function ScheduleTabsLayout({ children }: { children: React.ReactNode }) {
  usePageTitle("Schedule");

  return (
    <div className="space-y-4">
      <RouteTabs tabs={tabs} />
      {children}
    </div>
  );
}
