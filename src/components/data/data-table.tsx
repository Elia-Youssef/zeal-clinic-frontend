import { type ReactNode } from "react"
import { MoreHorizontal } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type Column<T> = {
  key: string
  header: string
  className?: string
  render: (row: T) => ReactNode
}

export type RowAction<T> = {
  label: string
  icon?: ReactNode
  onClick: (row: T) => void
  destructive?: boolean
  hidden?: (row: T) => boolean
  disabled?: (row: T) => boolean
}

function RowActionsMenu<T>({
  row,
  actions,
}: {
  row: T
  actions: RowAction<T>[]
}) {
  const visible = actions.filter((a) => !a.hidden?.(row))
  if (visible.length === 0) return null
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
      <DropdownMenuContent align="end">
        {visible.map((action) => (
          <DropdownMenuItem
            key={action.label}
            variant={action.destructive ? "destructive" : "default"}
            disabled={action.disabled?.(row)}
            onClick={(e) => {
              e.stopPropagation()
              action.onClick(row)
            }}
          >
            {action.icon}
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  onRowClick,
  actions,
  rowClassName,
}: {
  columns: Column<T>[]
  data: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  actions?: RowAction<T>[]
  rowClassName?: (row: T) => string | undefined
}) {
  const hasActions = !!actions && actions.length > 0
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead key={col.key} className={col.className}>
              {col.header}
            </TableHead>
          ))}
          {hasActions && <TableHead className="w-10 text-right" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => {
          const extraClass = rowClassName?.(row)
          const cls = [onRowClick ? "cursor-pointer" : "", extraClass ?? ""]
            .filter(Boolean)
            .join(" ")
          return (
          <TableRow
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cls || undefined}
          >
            {columns.map((col) => (
              <TableCell key={col.key} className={col.className}>
                {col.render(row)}
              </TableCell>
            ))}
            {hasActions && (
              <TableCell className="w-10 text-right">
                <div className="flex justify-end">
                  <RowActionsMenu row={row} actions={actions!} />
                </div>
              </TableCell>
            )}
          </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
