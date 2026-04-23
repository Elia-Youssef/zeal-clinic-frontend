"use client";

import { usePageTitle } from "@/hooks/use-page-title";
import { RouteTabs } from "@/components/route-tabs";

const tabs = [
  { label: "Calendar", href: "/schedule/calendar" },
  { label: "Rooms", href: "/schedule/rooms" },
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
