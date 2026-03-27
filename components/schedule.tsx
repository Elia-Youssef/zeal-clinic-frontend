"use client"

import { useState, useEffect } from "react"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs } from "@/components/tabs"
import { AppointmentForm, type AppointmentFormData } from "@/components/appointment-form"

// Types
export type Room = {
  id: string
  name: string
  type: string
}

export type Appointment = {
  id: string
  patientId: string
  patientName: string
  roomId: string
  patientProcedureSessionId?: string
  type: "Consultation" | "Procedure" | "Follow-up"
  status: "Scheduled" | "Completed" | "Cancelled"
  date: string // "YYYY-MM-DD"
  startTime: string // "HH:mm" 24h
  endTime: string // "HH:mm" 24h
  notes: string
}

// Temp data
const rooms: Room[] = [
  { id: "room-1", name: "Room 1", type: "Consultation" },
  { id: "room-2", name: "Room 2", type: "Procedure" },
  { id: "room-3", name: "Room 3", type: "General" },
  { id: "room-4", name: "Room 4", type: "Consultation" },
  { id: "room-5", name: "Room 5", type: "Procedure" },
  { id: "room-6", name: "Room 6", type: "General" },
  { id: "room-7", name: "Room 7", type: "Consultation" },
  { id: "hospital", name: "Hospital", type: "Hospital" },
]

const appointments: Appointment[] = [
  { id: "1", patientId: "pat-1", patientName: "Sarah Johnson", roomId: "room-1", type: "Consultation", status: "Completed", date: "2026-03-27", startTime: "09:00", endTime: "10:00", notes: "" },
  { id: "2", patientId: "pat-2", patientName: "Michael J. Chen", roomId: "room-2", type: "Procedure", status: "Cancelled", date: "2026-03-27", startTime: "10:00", endTime: "11:30", notes: "" },
  { id: "3", patientId: "pat-3", patientName: "James Wilson", roomId: "room-3", type: "Consultation", status: "Cancelled", date: "2026-03-27", startTime: "11:00", endTime: "12:00", notes: "" },
  { id: "4", patientId: "pat-2", patientName: "Michael J. Chen", roomId: "room-4", type: "Consultation", status: "Cancelled", date: "2026-03-27", startTime: "12:00", endTime: "13:00", notes: "" },
  { id: "5", patientId: "pat-4", patientName: "Emily A. Rodriguez", roomId: "room-1", type: "Follow-up", status: "Cancelled", date: "2026-03-27", startTime: "14:00", endTime: "15:00", notes: "" },
  { id: "6", patientId: "pat-5", patientName: "John Doe", roomId: "room-1", type: "Consultation", status: "Scheduled", date: "2026-03-28", startTime: "09:00", endTime: "10:00", notes: "" },
  { id: "7", patientId: "pat-6", patientName: "Jane Smith", roomId: "room-2", type: "Procedure", status: "Scheduled", date: "2026-03-28", startTime: "10:00", endTime: "11:00", notes: "" },
]

// Constants
const HOUR_HEIGHT = 64
const HOURS = Array.from({ length: 11 }, (_, i) => i + 8) // 8 AM to 6 PM

// Helpers
function formatHour(hour: number) {
  const h = hour % 12 || 12
  const ampm = hour < 12 ? "AM" : "PM"
  return `${h}:00 ${ampm}`
}

function timeToDecimal(time: string) {
  const [h, m] = time.split(":").map(Number)
  return h + m / 60
}

function toDateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function getWeekStart(date: Date) {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function getWeekDays(date: Date) {
  const start = getWeekStart(date)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return d
  })
}

function padHour(hour: number) {
  return String(hour).padStart(2, "0")
}

const typeColors: Record<string, string> = {
  Consultation: "bg-blue-500/15 border-blue-500/30 text-blue-700 dark:text-blue-300",
  Procedure: "bg-pink-500/15 border-pink-500/30 text-pink-700 dark:text-pink-300",
  "Follow-up": "bg-green-500/15 border-green-500/30 text-green-700 dark:text-green-300",
}

const statusBadgeColors: Record<string, string> = {
  Scheduled: "bg-blue-500 text-white",
  Completed: "bg-green-500 text-white",
  Cancelled: "bg-red-500 text-white",
}

// Day View

function DayView({
  date,
  onCellClick,
  onAppointmentClick,
}: {
  date: Date
  onCellClick: (roomId: string, hour: number) => void
  onAppointmentClick: (appt: Appointment) => void
}) {
  const [now, setNow] = useState(new Date())
  const dateStr = toDateStr(date)
  const dayAppts = appointments.filter((a) => a.date === dateStr)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const isToday = toDateStr(now) === dateStr
  const currentDecimal = now.getHours() + now.getMinutes() / 60
  const showLine = isToday && currentDecimal >= 8 && currentDecimal <= 18

  return (
    <div>
      {/* Date header */}
      <div className="mb-4 flex items-center gap-3">
        <Clock className="size-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">
          {date.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </h2>
        <Badge
          variant="secondary"
          className="border-0 bg-green-500/20 text-green-500"
        >
          {dayAppts.length} appointment{dayAppts.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Room headers */}
          <div className="flex border-b border-border">
            <div className="w-20 shrink-0 p-2 text-xs text-muted-foreground">
              Time
            </div>
            {rooms.map((room) => (
              <div
                key={room.id}
                className="flex-1 border-l border-border p-2 text-center"
              >
                <div className="text-sm font-medium">{room.name}</div>
                <div className="text-xs text-muted-foreground">{room.type}</div>
              </div>
            ))}
          </div>

          {/* Time grid body */}
          <div className="relative flex">
            {/* Time labels */}
            <div className="w-20 shrink-0">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="flex items-start border-b border-border p-2 text-xs text-muted-foreground"
                  style={{ height: HOUR_HEIGHT }}
                >
                  {formatHour(hour)}
                </div>
              ))}
            </div>

            {/* Room columns */}
            {rooms.map((room) => {
              const roomAppts = dayAppts.filter((a) => a.roomId === room.id)
              return (
                <div
                  key={room.id}
                  className="relative flex-1 border-l border-border"
                >
                  {/* Clickable hour cells */}
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="border-b border-border transition-colors hover:bg-muted/30"
                      style={{ height: HOUR_HEIGHT, cursor: "pointer" }}
                      onClick={() => onCellClick(room.id, hour)}
                    />
                  ))}

                  {/* Appointment blocks */}
                  {roomAppts.map((appt) => {
                    const top =
                      (timeToDecimal(appt.startTime) - 8) * HOUR_HEIGHT
                    const height =
                      (timeToDecimal(appt.endTime) -
                        timeToDecimal(appt.startTime)) *
                      HOUR_HEIGHT
                    return (
                      <div
                        key={appt.id}
                        className={cn(
                          "absolute left-1 right-1 cursor-pointer overflow-hidden rounded-md border p-2 transition-opacity hover:opacity-80",
                          typeColors[appt.type]
                        )}
                        style={{ top, height }}
                        onClick={(e) => {
                          e.stopPropagation()
                          onAppointmentClick(appt)
                        }}
                      >
                        <div className="truncate text-sm font-medium">
                          {appt.patientName}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-xs">
                          <span>{appt.type}</span>
                          <span
                            className={cn(
                              "rounded px-1 py-0.5 text-[10px] font-medium",
                              statusBadgeColors[appt.status]
                            )}
                          >
                            {appt.status}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {/* Red current time line */}
            {showLine && (
              <div
                className="pointer-events-none absolute left-0 right-0 z-10"
                style={{ top: (currentDecimal - 8) * HOUR_HEIGHT }}
              >
                <div className="h-0.5 bg-red-500" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Week View

function WeekView({ date }: { date: Date }) {
  const weekDays = getWeekDays(date)
  const today = toDateStr(new Date())
  const weekStart = weekDays[0]
  const weekEnd = weekDays[6]

  const shortDate = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  const dayLabel = (d: Date) =>
    d.toLocaleDateString("en-US", { weekday: "short" })

  return (
    <div>
      {/* Week header */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold">
          Week of {shortDate(weekStart)} &ndash; {shortDate(weekEnd)},{" "}
          {weekEnd.getFullYear()}
        </h2>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Room header row */}
          <div
            className="grid border-b border-border"
            style={{
              gridTemplateColumns: `100px repeat(${rooms.length}, 1fr)`,
            }}
          >
            <div className="p-3" />
            {rooms.map((room) => (
              <div
                key={room.id}
                className="border-l border-border p-3 text-center"
              >
                <div className="text-sm font-medium">{room.name}</div>
                <div className="text-xs text-muted-foreground">{room.type}</div>
              </div>
            ))}
          </div>

          {/* Day rows */}
          {weekDays.map((day) => {
            const dayStr = toDateStr(day)
            const isToday = dayStr === today
            return (
              <div
                key={dayStr}
                className={cn(
                  "grid border-b border-border",
                  isToday && "bg-primary/10"
                )}
                style={{
                  gridTemplateColumns: `100px repeat(${rooms.length}, 1fr)`,
                }}
              >
                <div className={cn("p-3", isToday && "font-semibold")}>
                  <div className="text-sm">{dayLabel(day)}</div>
                  <div className="text-xs text-muted-foreground">
                    {shortDate(day)}
                  </div>
                </div>
                {rooms.map((room) => {
                  const count = appointments.filter(
                    (a) => a.date === dayStr && a.roomId === room.id
                  ).length
                  return (
                    <div
                      key={room.id}
                      className="flex items-center justify-center border-l border-border p-3"
                    >
                      {count > 0 ? (
                        <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                          {count}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Main Schedule Component

export function Schedule() {
  const [view, setView] = useState<"Day" | "Week">("Day")
  const [currentDate] = useState(() => new Date())
  const [modalOpen, setModalOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [formData, setFormData] = useState<
    Partial<AppointmentFormData> | undefined
  >()

  const openForm = (data: Partial<AppointmentFormData>) => {
    setFormData(data)
    setFormKey((k) => k + 1)
    setModalOpen(true)
  }

  const handleCellClick = (roomId: string, hour: number) => {
    const dateStr = toDateStr(currentDate)
    openForm({
      roomId,
      startTime: `${dateStr}T${padHour(hour)}:00`,
      endTime: `${dateStr}T${padHour(hour + 1)}:00`,
      status: "Scheduled",
    })
  }

  const handleAppointmentClick = (appt: Appointment) => {
    openForm({
      id: appt.id,
      patientId: appt.patientId,
      roomId: appt.roomId,
      patientProcedureSessionId: appt.patientProcedureSessionId ?? "",
      startTime: `${appt.date}T${appt.startTime}`,
      endTime: `${appt.date}T${appt.endTime}`,
      status: appt.status,
      notes: appt.notes,
    })
  }

  return (
    <div className="space-y-4">
      <Tabs
        tabs={["Day", "Week"]}
        onChange={(tab) => setView(tab as "Day" | "Week")}
      />

      <Card>
        <CardContent className="pt-6">
          {view === "Day" ? (
            <DayView
              date={currentDate}
              onCellClick={handleCellClick}
              onAppointmentClick={handleAppointmentClick}
            />
          ) : (
            <WeekView date={currentDate} />
          )}
        </CardContent>
      </Card>

      <AppointmentForm
        key={formKey}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        rooms={rooms.map((r) => ({ id: r.id, name: r.name }))}
        initialData={formData}
      />
    </div>
  )
}
