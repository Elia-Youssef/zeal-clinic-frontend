import { type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type RowAction<T> = {
  label: string;
  icon?: ReactNode;
  onClick: (row: T) => void;
  destructive?: boolean;
  hidden?: (row: T) => boolean;
  disabled?: (row: T) => boolean;
};

export function getDefaultRowAction<T>(
  row: T,
  actions?: RowAction<T>[],
): RowAction<T> | undefined {
  return actions?.find(
    (action) =>
      /^edit\b/i.test(action.label) &&
      !action.hidden?.(row) &&
      !action.disabled?.(row),
  );
}

export function RowActionsMenu<T>({
  row,
  actions,
}: {
  row: T;
  actions: RowAction<T>[];
}) {
  const visible = actions.filter((a) => !a.hidden?.(row));
  if (visible.length === 0) return null;

  const safe = visible.filter((a) => !a.destructive);
  const danger = visible.filter((a) => !!a.destructive);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => e.stopPropagation()}
            aria-label="Row actions"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={4} className="min-w-40">
        {safe.map((action) => (
          <DropdownMenuItem
            key={action.label}
            disabled={action.disabled?.(row)}
            onClick={(e) => {
              e.stopPropagation();
              action.onClick(row);
            }}
          >
            {action.icon}
            <span>{action.label}</span>
          </DropdownMenuItem>
        ))}
        {safe.length > 0 && danger.length > 0 && <DropdownMenuSeparator />}
        {danger.map((action) => (
          <DropdownMenuItem
            key={action.label}
            variant="destructive"
            disabled={action.disabled?.(row)}
            onClick={(e) => {
              e.stopPropagation();
              action.onClick(row);
            }}
          >
            {action.icon}
            <span>{action.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
