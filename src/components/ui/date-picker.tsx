
import * as React from "react"
import { CalendarIcon, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

function formatDisplay(date: Date | undefined) {
  if (!date) return ""
  const d = String(date.getDate()).padStart(2, "0")
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const y = date.getFullYear()
  return `${d}/${m}/${y}`
}

function parseISO(iso: string): Date | undefined {
  if (!iso) return undefined
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return undefined
  return new Date(y, m - 1, d)
}

function toISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  required,
  disabled,
  className,
}: {
  value: string
  onChange: (iso: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = React.useState(false)
  const selected = parseISO(value)
  const showClear = !required && !!value && !disabled

  return (
    <div className={cn("relative w-full", className)}>
      <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              disabled={disabled}
              className={cn(
                "w-full justify-start text-left font-normal",
                !value && "text-muted-foreground",
                showClear && "pr-8",
              )}
            />
          }
        >
          <CalendarIcon className="size-4 text-muted-foreground" />
          {value ? formatDisplay(selected) : placeholder}
          {required && !value && <span className="sr-only">(required)</span>}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => {
              if (date) {
                onChange(toISO(date))
                setOpen(false)
              }
            }}
            defaultMonth={selected}
          />
        </PopoverContent>
      </Popover>
      {showClear && (
        <span
          role="button"
          tabIndex={0}
          aria-label="Clear date"
          onClick={(e) => {
            e.stopPropagation()
            onChange("")
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              e.stopPropagation()
              onChange("")
            }
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-1/2 right-2 inline-flex size-4 -translate-y-1/2 items-center justify-center rounded text-muted-foreground opacity-60 transition-opacity hover:opacity-100"
        >
          <X className="size-3.5" />
        </span>
      )}
    </div>
  )
}
