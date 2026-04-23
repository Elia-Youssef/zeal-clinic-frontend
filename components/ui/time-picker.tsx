"use client"

import * as React from "react"
import { Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export function TimePicker({
  value,
  onChange,
  placeholder = "Pick a time",
  required,
  className,
}: {
  value: string
  onChange: (time: string) => void
  placeholder?: string
  required?: boolean
  className?: string
}) {
  const [open, setOpen] = React.useState(false)

  const hours = Array.from({ length: 24 }, (_, i) =>
    String(i).padStart(2, "0"),
  )
  const minutes = ["00", "15", "30", "45"]

  const selectedHour = value?.slice(0, 2) ?? ""
  const selectedMinute = value?.slice(3, 5) ?? ""

  const pick = (h: string, m: string, close: boolean) => {
    onChange(`${h}:${m}`)
    if (close) setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground",
              className,
            )}
          />
        }
      >
        <Clock className="size-4 text-muted-foreground" />
        {value || placeholder}
        {required && !value && <span className="sr-only">(required)</span>}
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0" align="start">
        <div className="flex h-56">
          {/* Hours column */}
          <div className="flex-1 overflow-y-auto border-r border-border p-1">
            {hours.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => pick(h, selectedMinute || "00", false)}
                className={cn(
                  "w-full rounded-md px-2 py-1 text-center text-sm hover:bg-muted",
                  selectedHour === h && "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                {h}
              </button>
            ))}
          </div>
          {/* Minutes column */}
          <div className="flex-1 overflow-y-auto p-1">
            {minutes.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => pick(selectedHour || "08", m, true)}
                className={cn(
                  "w-full rounded-md px-2 py-1 text-center text-sm hover:bg-muted",
                  selectedMinute === m && "bg-primary text-primary-foreground hover:bg-primary/90",
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
