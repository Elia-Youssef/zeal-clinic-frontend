
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DetailField({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <span className="text-xs font-medium tracking-wide text-muted-foreground">
        {label}
      </span>
      {typeof children === "string" || typeof children === "number" ? (
        <p className="text-sm text-foreground">{children}</p>
      ) : (
        children
      )}
    </div>
  );
}
