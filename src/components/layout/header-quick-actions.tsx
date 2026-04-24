"use client";

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

type FormProps = { open: boolean; onClose: () => void; onSaved: () => void };

type QuickAction = {
  label: string;
  icon: LucideIcon;
  form: ComponentType<FormProps>;
};

const quickActions: QuickAction[] = [
  { label: "New Patient", icon: UserPlus, form: PatientForm },
  { label: "New Appointment", icon: CalendarPlus, form: AppointmentForm },
  { label: "New Invoice", icon: FileText, form: ClientInvoiceForm },
];

export function HeaderQuickActions() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const ActiveForm =
    activeIndex != null ? quickActions[activeIndex].form : null;

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
          {quickActions.map((action, i) => (
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
