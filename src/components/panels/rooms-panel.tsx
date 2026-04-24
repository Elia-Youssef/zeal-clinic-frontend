/**
 * rooms-panel.tsx: CRUD panel for clinic rooms.
 * Used inside the Services page (Rooms tab).
 */
"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { type Column, type RowAction } from "@/components/data/data-table";
import { DataList } from "@/components/data/data-list";
import { AddButton } from "@/components/shared/add-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/shared/modal";
import { api } from "@/lib/api";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import { roomTypeOptions } from "@/lib/constants";
import type { Room } from "@/lib/types";
import { usePermissions } from "@/hooks/use-permissions";

/* ------------------------------------------------------------------ */
/*  Room form                                                          */
/* ------------------------------------------------------------------ */

function RoomForm({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: Room;
}) {
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<string>(initial?.type ?? "General");
  const [isAvailable, setIsAvailable] = useState(initial?.isAvailable ?? true);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = { name, type, isAvailable };
    try {
      if (isEdit) {
        await api.put(`/rooms/${initial.id}`, payload);
        addAlert("success", "Room updated.");
      } else {
        await api.post("/rooms", payload);
        addAlert("success", "Room created.");
      }
      onSaved();
      onClose();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Room" : "New Room"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Name *</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Type *</label>
            <SearchableDropdown
              value={type}
              onChange={setType}
              options={roomTypeOptions}
              placeholder="Select type…"
              required
            />
          </div>
          <div className="flex items-end gap-2 pb-1">
            <input
              type="checkbox"
              id="roomAvail"
              checked={isAvailable}
              onChange={(e) => setIsAvailable(e.target.checked)}
              className="size-4"
            />
            <label htmlFor="roomAvail" className="text-sm font-medium">
              Available
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : isEdit ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Rooms panel                                                        */
/* ------------------------------------------------------------------ */

export function RoomsPanel() {
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Room | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaved = () => setRefreshKey((k) => k + 1);

  const handleDelete = async (r: Room) => {
    if (!confirm(`Delete room "${r.name}"?`)) return;
    try {
      await api.del(`/rooms/${r.id}`);
      addAlert("success", "Room deleted.");
      handleSaved();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  const columns: Column<Room>[] = [
    {
      key: "name",
      header: "Name",
      render: (r) => <span className="font-medium">{r.name}</span>,
    },
    {
      key: "type",
      header: "Type",
      render: (r) => <Badge variant="outline">{r.type}</Badge>,
    },
    {
      key: "avail",
      header: "Available",
      render: (r) =>
        r.isAvailable ? (
          <Badge>Yes</Badge>
        ) : (
          <Badge variant="secondary">No</Badge>
        ),
    },
  ];

  const actions: RowAction<Room>[] = [
    ...(can("rooms:write")
      ? [{
          label: "Edit",
          icon: <Pencil className="size-3.5" />,
          onClick: (r: Room) => {
            setEditing(r);
            setFormOpen(true);
          },
        }]
      : []),
    ...(can("rooms:delete")
      ? [{
          label: "Delete",
          icon: <Trash2 className="size-3.5" />,
          destructive: true,
          onClick: (r: Room) => handleDelete(r),
        }]
      : []),
  ];

  return (
    <>
      <DataList<Room>
        title="Rooms"
        endpoint="/rooms"
        columns={columns}
        actions={actions}
        rowKey={(r) => r.id}
        emptyMessage="No rooms yet."
        headerActions={
          can("rooms:write") ? (
            <AddButton
              label="Add Room"
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            />
          ) : undefined
        }
        refreshKey={refreshKey}
      />
      <RoomForm
        key={editing?.id ?? "new"}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
        initial={editing}
      />
    </>
  );
}
