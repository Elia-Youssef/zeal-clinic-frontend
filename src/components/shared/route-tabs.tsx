import { useEffect, useId } from "react"
import { Link } from "react-router-dom"
import { useLocation } from "react-router-dom"
import { motion } from "motion/react"
import { usePermissions } from "@/hooks/use-permissions"
import { useTitleStore } from "@/lib/stores/title-store"
import { cn } from "@/lib/utils"

export type RouteTab = {
  label: string
  href: string
  scopes?: string[]
  mode?: "any" | "all"
}

export function RouteTabs({
  tabs,
}: {
  tabs: RouteTab[]
}) {
  const { pathname } = useLocation()
  const { canAny, canAll } = usePermissions()
  const layoutId = useId()

  const visibleTabs = tabs.filter((tab) => {
    if (!tab.scopes?.length) return true
    return tab.mode === "all" ? canAll(...tab.scopes) : canAny(...tab.scopes)
  })

  // The active tab names the page in the browser tab's title.
  const activeLabel = visibleTabs.find((tab) => tab.href === pathname)?.label ?? ""
  const setTab = useTitleStore((s) => s.setTab)
  useEffect(() => {
    setTab(activeLabel)
    return () => setTab("")
  }, [activeLabel, setTab])

  if (visibleTabs.length === 0) return null

  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <div className="flex justify-center">
        <div className="inline-flex gap-1 rounded-lg bg-muted p-1">
          {visibleTabs.map((tab) => {
            const isActive = pathname === tab.href
            return (
              <Link
                key={tab.href}
                to={tab.href}
                aria-current={isActive ? "page" : undefined}
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
                <span className="relative z-10">{tab.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
