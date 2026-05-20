import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  appointmentStatusStyles,
  defaultAppointmentStatusStyle,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  STATUS_ICONS,
  TRANSITION_STATUSES,
  type TransitionStatus,
} from "./types";

export function StatusPicker({
  status,
  onChange,
}: {
  status: string;
  onChange: (next: TransitionStatus) => void;
}) {
  const others = TRANSITION_STATUSES.filter((s) => s !== status);
  const CurrentIcon = STATUS_ICONS[status];
  const badgeClass = (
    appointmentStatusStyles[status] ?? defaultAppointmentStatusStyle
  ).badge;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
              badgeClass,
            )}
          >
            {CurrentIcon && <CurrentIcon className="size-3.5" />}
            {status}
            <ChevronDown className="size-3" />
          </button>
        }
      />
      <DropdownMenuContent align="end">
        {others.map((s) => {
          const Icon = STATUS_ICONS[s];
          return (
            <DropdownMenuItem key={s} onClick={() => onChange(s)}>
              {Icon && <Icon className="size-4" />}
              {s}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
