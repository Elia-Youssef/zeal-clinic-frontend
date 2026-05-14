import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { type Column, type RowAction } from "@/components/data/data-table";
import { DataList } from "@/components/data/data-list";
import { AddButton } from "@/components/shared/add-button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import type { Room } from "@/lib/types";
import { RoomForm } from "@/components/forms/room-form";
import { usePermissions } from "@/hooks/use-permissions";
import { useConfirm } from "@/hooks/use-confirm";

export default function RoomsPage() {
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const confirm = useConfirm();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Room | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaved = () => setRefreshKey((k) => k + 1);

  const handleDelete = async (r: Room) => {
    if (
      !(await confirm({
        title: "Delete room?",
        description: `Delete room "${r.name}"?`,
        confirmText: "Delete",
      }))
    ) {
      return;
    }
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
      sortable: true,
      sortKey: "name",
      render: (r) => <span className="font-medium">{r.name}</span>,
    },
    {
      key: "type",
      header: "Type",
      sortable: true,
      sortKey: "type",
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
      ? [
          {
            label: "Edit",
            icon: <Pencil className="size-3.5" />,
            onClick: (r: Room) => {
              setEditing(r);
              setFormOpen(true);
            },
          },
        ]
      : []),
    ...(can("rooms:delete")
      ? [
          {
            label: "Delete",
            icon: <Trash2 className="size-3.5" />,
            destructive: true,
            onClick: (r: Room) => handleDelete(r),
          },
        ]
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
