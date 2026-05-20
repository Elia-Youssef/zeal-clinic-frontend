import { useId, useState } from "react"
import { motion } from "motion/react"
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
  const layoutId = useId()

  const handleClick = (tab: string) => {
    setInternal(tab)
    onChange?.(tab)
  }

  return (
    <div className="-mx-4 max-w-full overflow-x-auto px-4">
      <div className="inline-flex gap-1 rounded-lg bg-muted p-1">
        {tabs.map((tab) => {
          const isActive = active === tab
          return (
            <button
              key={tab}
              onClick={() => handleClick(tab)}
              className={cn(
                "relative shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {isActive && (
                <motion.span
                  layoutId={layoutId}
                  className="absolute inset-0 rounded-md bg-background shadow-sm"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <span className="relative z-10">{tab}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
