import { usePageTitle } from "@/hooks/use-page-title";
import { RouteTabs } from "@/components/shared/route-tabs";

const tabs = [
  { label: "Patients", href: "/patients/list", scopes: ["patients:read"] },
  {
    label: "Allergies",
    href: "/patients/allergies",
    scopes: ["allergies:read"],
  },
  {
    label: "Medicines",
    href: "/patients/medicines",
    scopes: ["medicines:read"],
  },
];

export default function PatientsTabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  usePageTitle("Patients");

  return (
    <div className="space-y-4">
      <RouteTabs tabs={tabs} />
      {children}
    </div>
  );
}
