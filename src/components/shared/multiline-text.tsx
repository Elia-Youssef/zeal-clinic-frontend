import { cn } from "@/lib/utils";

/** Renders free-text (e.g. notes) preserving line breaks, with a "---" empty fallback. */
export function MultilineText({
  value,
  className,
}: {
  value?: string | null;
  className?: string;
}) {
  return (
    <p className={cn("text-sm text-foreground whitespace-pre-wrap", className)}>
      {value || "---"}
    </p>
  );
}
