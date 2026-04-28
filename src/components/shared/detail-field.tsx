
import type { ReactNode } from "react";

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
    <div className={className}>
      <span className="text-muted-foreground">{label}</span>
      {typeof children === "string" || typeof children === "number" ? (
        <p>{children}</p>
      ) : (
        children
      )}
    </div>
  );
}
