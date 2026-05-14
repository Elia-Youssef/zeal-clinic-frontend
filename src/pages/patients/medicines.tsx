
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { type Column, type RowAction } from "@/components/data/data-table";
import { DataList } from "@/components/data/data-list";
import { AddButton } from "@/components/shared/add-button";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import type { Medicine } from "@/lib/types";
import { MedicineForm } from "@/components/forms/medicine-form";
import { usePermissions } from "@/hooks/use-permissions";
import { useConfirm } from "@/hooks/use-confirm";

export default function MedicinesPage() {
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const confirm = useConfirm();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Medicine | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaved = () => setRefreshKey((k) => k + 1);

  const handleDelete = async (m: Medicine) => {
    if (
      !(await confirm({
        title: "Delete medicine?",
        description: `Delete medicine "${m.name}"?`,
        confirmText: "Delete",
      }))
    ) {
      return;
    }
    try {
      await api.del(`/medicines/${m.id}`);
      addAlert("success", "Medicine deleted.");
      handleSaved();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  const columns: Column<Medicine>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      sortKey: "name",
      render: (m) => <span className="font-medium">{m.name}</span>,
    },
    { key: "desc", header: "Description", render: (m) => m.description || "---" },
  ];

  const actions: RowAction<Medicine>[] = [
    ...(can("medicines:write")
      ? [{
          label: "Edit",
          icon: <Pencil className="size-3.5" />,
          onClick: (m: Medicine) => {
            setEditing(m);
            setFormOpen(true);
          },
        }]
      : []),
    ...(can("medicines:delete")
      ? [{
          label: "Delete",
          icon: <Trash2 className="size-3.5" />,
          destructive: true,
          onClick: (m: Medicine) => handleDelete(m),
        }]
      : []),
  ];

  return (
    <>
      <DataList<Medicine>
        title="Medicines"
        endpoint="/medicines"
        columns={columns}
        actions={actions}
        rowKey={(m) => m.id}
        emptyMessage="No medicines defined."
        headerActions={
          can("medicines:write") ? (
            <AddButton
              label="Add Medicine"
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            />
          ) : undefined
        }
        refreshKey={refreshKey}
      />
      <MedicineForm
        key={editing?.id ?? "new"}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
        initial={editing}
      />
    </>
  );
}
