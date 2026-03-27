"use client"

import { createContext, useCallback, useContext, useState } from "react"

export type AlertType = "success" | "error" | "warning" | "info"

export type Alert = {
  id: string
  type: AlertType
  message: string
}

type GlobalAlertContextType = {
  alerts: Alert[]
  addAlert: (type: AlertType, message: string) => void
  removeAlert: (id: string) => void
  clearAlerts: () => void
}

const GlobalAlertContext = createContext<GlobalAlertContextType | null>(null)

export function GlobalAlertProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [alerts, setAlerts] = useState<Alert[]>([])

  const addAlert = useCallback((type: AlertType, message: string) => {
    const id = crypto.randomUUID()
    setAlerts((prev) => [...prev, { id, type, message }])

    // auto-dismiss after 5 seconds
    setTimeout(() => {
      setAlerts((prev) => prev.filter((a) => a.id !== id))
    }, 5000)
  }, [])

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const clearAlerts = useCallback(() => {
    setAlerts([])
  }, [])

  return (
    <GlobalAlertContext.Provider
      value={{ alerts, addAlert, removeAlert, clearAlerts }}
    >
      {children}
    </GlobalAlertContext.Provider>
  )
}

export function useGlobalAlert() {
  const context = useContext(GlobalAlertContext)
  if (!context)
    throw new Error("useGlobalAlert must be used within GlobalAlertProvider")
  return context
}
