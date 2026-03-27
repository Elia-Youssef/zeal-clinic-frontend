"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"

import { ThemeProvider } from "@/contexts/theme-context"
import { GlobalAlertProvider, useGlobalAlert } from "@/contexts/global-alert-context"
import { TooltipProvider } from "@/components/ui/tooltip"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"

function AlertBar() {
  const { alerts, removeAlert } = useGlobalAlert()

  if (alerts.length === 0) return null

  const colors: Record<string, string> = {
    success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  }

  return (
    <div className="space-y-1 px-6 pt-4">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-center justify-between rounded-md px-4 py-2 text-sm ${colors[alert.type]}`}
        >
          <span>{alert.message}</span>
          <button onClick={() => removeAlert(alert.id)}>
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.replace("/")
    } else {
      setChecked(true)
    }
  }, [router])

  if (!checked) return null

  return <>{children}</>
}

export function DashboardWrapper({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <ThemeProvider>
      <GlobalAlertProvider>
        <TooltipProvider>
          <AuthGate>
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset>
                <AppHeader title={title} />
                <AlertBar />
                <div className="flex-1 overflow-auto p-6">{children}</div>
              </SidebarInset>
            </SidebarProvider>
          </AuthGate>
        </TooltipProvider>
      </GlobalAlertProvider>
    </ThemeProvider>
  )
}
