import * as React from "react"
import { CalendarIcon, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn, fieldValueId } from "@/lib/utils"

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
  const parsed = new Date(y, m - 1, d)
  if (
    parsed.getFullYear() !== y ||
    parsed.getMonth() !== m - 1 ||
    parsed.getDate() !== d
  ) {
    return undefined
  }
  return parsed
}

function toISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "Pick a date",
  required,
  disabled,
  className,
  min,
  max,
}: {
  /** The trigger's id, for a <label htmlFor>; the label names it, the shown date describes it. */
  id?: string
  value: string
  onChange: (iso: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
  min?: string
  max?: string
}) {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const selected = parseISO(value)
  const showClear = !required && !!value && !disabled
  // The label names the trigger, so its own text is read only through these ids.
  const valueId = fieldValueId(id)
  const requiredId = id && required && !value ? `${id}-required` : undefined
  const minDate = parseISO(min ?? "")
  const maxDate = parseISO(max ?? "")
  const disabledMatcher = React.useMemo(() => {
    if (minDate && maxDate) return [{ before: minDate }, { after: maxDate }]
    if (minDate) return { before: minDate }
    if (maxDate) return { after: maxDate }
    return undefined
  }, [minDate, maxDate])

  return (
    <div className={cn("relative w-full", className)}>
      <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
        <PopoverTrigger
          ref={triggerRef}
          id={id}
          aria-describedby={
            [valueId, requiredId].filter(Boolean).join(" ") || undefined
          }
          render={
            <Button
              variant="outline"
              disabled={disabled}
              className={cn(
                "w-full justify-start text-left font-normal",
                !selected && "text-muted-foreground",
                showClear && "pr-8",
              )}
            />
          }
        >
          <CalendarIcon className="size-4 text-muted-foreground" />
          <span id={valueId}>
            {selected ? formatDisplay(selected) : placeholder}
          </span>
          {required && !value && (
            <span id={requiredId} className="sr-only">
              (required)
            </span>
          )}
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
            defaultMonth={selected ?? minDate ?? maxDate}
            disabled={disabledMatcher}
          />
        </PopoverContent>
      </Popover>
      {showClear && (
        <button
          type="button"
          aria-label="Clear date"
          onClick={(e) => {
            e.stopPropagation()
            onChange("")
            // This button goes away with the value; keep the focus on the field.
            triggerRef.current?.focus()
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-1/2 right-2 inline-flex size-4 -translate-y-1/2 items-center justify-center rounded p-0 text-muted-foreground opacity-60 transition-opacity hover:opacity-100"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
