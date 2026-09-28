import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const labelClass = {
  default: "text-sm font-medium",
  small: "text-xs font-medium text-muted-foreground",
  muted: "text-xs text-muted-foreground",
} as const;

/**
 * A labelled form field: owns the wrapper, the <label>, the required mark
 * and the field's ids, and hands the ids to the control through a render
 * function, so a label and its control cannot drift apart.
 *
 * By default the label points at the control: it renders `htmlFor` and the
 * control takes `id`. With `group` the label leaves the control alone and
 * its own id names a control that names itself from it (a date input's
 * labelled boxes, a labelled button group).
 */
export function FormField({
  label,
  required,
  size = "default",
  group = false,
  className,
  actions,
  children,
}: {
  label: ReactNode;
  /** Appends the required mark (" *") to the label text. */
  required?: boolean;
  /**
   * `small` is the muted label of the sign-in fields and filter controls;
   * `muted` the quieter row label of the invoice item lines.
   */
  size?: "default" | "small" | "muted";
  /** The label names a group instead of pointing at a control. */
  group?: boolean;
  /** Wrapper classes; they extend or override the default spacing. */
  className?: string;
  /** Content on the label's line, aligned to the far edge. */
  actions?: ReactNode;
  children: (ids: { id: string; labelId: string }) => ReactNode;
}) {
  const autoId = useId();
  const id = `${autoId}-field`;
  const labelId = `${autoId}-label`;

  const labelEl = (
    <label
      id={labelId}
      htmlFor={group ? undefined : id}
      className={labelClass[size]}
    >
      {label}
      {required ? " *" : ""}
    </label>
  );

  return (
    <div className={cn("space-y-1.5", className)}>
      {actions ? (
        <div className="flex items-center justify-between">
          {labelEl}
          {actions}
        </div>
      ) : (
        labelEl
      )}
      {children({ id, labelId })}
    </div>
  );
}
