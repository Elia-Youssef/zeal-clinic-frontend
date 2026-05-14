import { useState } from "react"
import { cn } from "@/lib/utils"

export function Tabs({
  tabs,
  defaultTab,
  activeTab,
  onChange,
}: {
  tabs: string[]
  defaultTab?: string
  activeTab?: string
  onChange?: (tab: string) => void
}) {
  const [internal, setInternal] = useState(defaultTab ?? tabs[0])
  const active = activeTab ?? internal

  const handleClick = (tab: string) => {
    setInternal(tab)
    onChange?.(tab)
  }

  return (
    <div className="-mx-4 max-w-full overflow-x-auto px-4">
      <div className="inline-flex gap-1 rounded-lg bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => handleClick(tab)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  )
}
