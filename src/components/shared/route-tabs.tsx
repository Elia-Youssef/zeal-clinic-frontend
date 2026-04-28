
import { Link } from "react-router-dom"
import { useLocation } from "react-router-dom"
import { usePermissions } from "@/hooks/use-permissions"
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
  const visibleTabs = tabs.filter((tab) => {
    if (!tab.scopes?.length) return true
    return tab.mode === "all" ? canAll(...tab.scopes) : canAny(...tab.scopes)
  })

  if (visibleTabs.length === 0) return null

  return (
    <div className="flex justify-center">
      <div className="inline-flex gap-1 rounded-lg bg-muted p-1">
        {visibleTabs.map((tab) => (
          <Link
            key={tab.href}
            to={tab.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              pathname === tab.href
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
