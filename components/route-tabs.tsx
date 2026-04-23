"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export function RouteTabs({
  tabs,
}: {
  tabs: { label: string; href: string }[]
}) {
  const pathname = usePathname()

  return (
    <div className="flex justify-center">
      <div className="inline-flex gap-1 rounded-lg bg-muted p-1">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
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
