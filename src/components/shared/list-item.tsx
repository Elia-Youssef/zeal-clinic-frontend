
import type { ReactNode } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * A bordered row used in inline lists (allergies, sessions, conflicts, etc.).
 * Shows content on the left with optional actions (including a delete button) on the right.
 */
export function ListItem({
  children,
  actions,
  onDelete,
}: {
  children: ReactNode
  /** Extra action buttons rendered before the delete button. */
  actions?: ReactNode
  onDelete?: () => void
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-sm">
      <div>{children}</div>
      {(actions || onDelete) && (
        <div className="flex items-center gap-1">
          {actions}
          {onDelete && (
            <Button variant="ghost" size="icon-sm" onClick={onDelete}>
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
