import type { ReactNode } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ListItem({
  children,
  actions,
  onDelete,
}: {
  children: ReactNode
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
