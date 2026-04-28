
import { useState, type ComponentType } from "react";
import {
  Plus,
  UserPlus,
  CalendarPlus,
  FileText,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PatientForm } from "@/components/forms/patient-form";
import { AppointmentForm } from "@/components/forms/appointment-form";
import { ClientInvoiceForm } from "@/components/forms/client-invoice-form";
import { usePermissions } from "@/hooks/use-permissions";

type FormProps = { open: boolean; onClose: () => void; onSaved: () => void };

type QuickAction = {
  label: string;
  icon: LucideIcon;
  form: ComponentType<FormProps>;
  scopes: string[];
};

const quickActions: QuickAction[] = [
  { label: "New Patient", icon: UserPlus, form: PatientForm, scopes: ["patients:write"] },
  { label: "New Appointment", icon: CalendarPlus, form: AppointmentForm, scopes: ["appointments:write"] },
  { label: "New Invoice", icon: FileText, form: ClientInvoiceForm, scopes: ["transactions:write", "patients:read"] },
];

export function HeaderQuickActions() {
  const { canAll } = usePermissions();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const visibleActions = quickActions.filter((action) => canAll(...action.scopes));
  const ActiveForm =
    activeIndex != null ? visibleActions[activeIndex]?.form : null;

  if (visibleActions.length === 0) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="secondary" size="sm" className="gap-1">
              <Plus className="size-4" />
              <span className="hidden sm:inline">Quick Action</span>
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-50">
          {visibleActions.map((action, i) => (
            <DropdownMenuItem
              key={action.label}
              onClick={() => setActiveIndex(i)}
              className="flex flex-row gap-2"
            >
              <action.icon className="size-4" />
              <div>{action.label}</div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {ActiveForm && (
        <ActiveForm
          open
          onClose={() => setActiveIndex(null)}
          onSaved={() => setActiveIndex(null)}
        />
      )}
    </>
  );
}
