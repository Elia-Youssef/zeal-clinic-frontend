"use client";

import { usePageTitle } from "@/hooks/use-page-title";
import { RouteTabs } from "@/components/shared/route-tabs";

const tabs = [
  { label: "List", href: "/patients/list" },
  { label: "Allergies", href: "/patients/allergies" },
  { label: "Medicines", href: "/patients/medicines" },
];

export default function PatientsTabsLayout({ children }: { children: React.ReactNode }) {
  usePageTitle("Patients");

  return (
    <div className="space-y-4">
      <RouteTabs tabs={tabs} />
      {children}
    </div>
  );
}
