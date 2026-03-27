"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/modal"

export type AppointmentFormData = {
  id?: string
  patientId: string
  roomId: string
  patientProcedureSessionId: string
  startTime: string
  endTime: string
  status: string
  notes: string
}

// Temp dropdown data, to be replaced by backend calls
const patients = [
  { id: "pat-1", name: "Sarah Johnson" },
  { id: "pat-2", name: "Michael J. Chen" },
  { id: "pat-3", name: "James Wilson" },
  { id: "pat-4", name: "Emily A. Rodriguez" },
  { id: "pat-5", name: "John Doe" },
  { id: "pat-6", name: "Jane Smith" },
]

const procedureSessions = [
  { id: "ps-1", name: "Session #1 — Dental Cleaning" },
  { id: "ps-2", name: "Session #2 — Physical Therapy" },
  { id: "ps-3", name: "Session #3 — Blood Work" },
]

const statuses = ["Scheduled", "Completed", "Cancelled"]

const selectClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30"

const textareaClass =
  "w-full min-w-0 resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30"

export function AppointmentForm({
  open,
  onClose,
  rooms,
  initialData,
}: {
  open: boolean
  onClose: () => void
  rooms: { id: string; name: string }[]
  initialData?: Partial<AppointmentFormData>
}) {
  const isEdit = !!initialData?.id

  const [form, setForm] = useState<AppointmentFormData>({
    patientId: "",
    roomId: "",
    patientProcedureSessionId: "",
    startTime: "",
    endTime: "",
    status: "Scheduled",
    notes: "",
    ...initialData,
  })

  const update = (field: keyof AppointmentFormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: call backend
    console.log(isEdit ? "Update appointment:" : "Create appointment:", form)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Appointment" : "New Appointment"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Patient */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Patient</label>
          <select
            className={selectClass}
            value={form.patientId}
            onChange={(e) => update("patientId", e.target.value)}
            required
          >
            <option value="">Select patient…</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Room */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Room</label>
          <select
            className={selectClass}
            value={form.roomId}
            onChange={(e) => update("roomId", e.target.value)}
            required
          >
            <option value="">Select room…</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* Procedure Session (optional) */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">
            Procedure Session{" "}
            <span className="text-muted-foreground">(optional)</span>
          </label>
          <select
            className={selectClass}
            value={form.patientProcedureSessionId}
            onChange={(e) =>
              update("patientProcedureSessionId", e.target.value)
            }
          >
            <option value="">None</option>
            {procedureSessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Start / End Time */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Start Time</label>
            <Input
              type="datetime-local"
              value={form.startTime}
              onChange={(e) => update("startTime", e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">End Time</label>
            <Input
              type="datetime-local"
              value={form.endTime}
              onChange={(e) => update("endTime", e.target.value)}
              required
            />
          </div>
        </div>

        {/* Status */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Status</label>
          <select
            className={selectClass}
            value={form.status}
            onChange={(e) => update("status", e.target.value)}
            required
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Notes</label>
          <textarea
            className={textareaClass}
            rows={3}
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="Optional notes…"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{isEdit ? "Update" : "Create"}</Button>
        </div>
      </form>
    </Modal>
  )
}
