"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

export function Tabs({
  tabs,
  defaultTab,
  onChange,
}: {
  tabs: string[]
  defaultTab?: string
  onChange?: (tab: string) => void
}) {
  const [active, setActive] = useState(defaultTab ?? tabs[0])

  const handleClick = (tab: string) => {
    setActive(tab)
    onChange?.(tab)
  }

  return (
    <div className="inline-flex gap-1 rounded-lg bg-muted p-1">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => handleClick(tab)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            active === tab
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}
