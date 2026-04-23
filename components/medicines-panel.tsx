"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { type Column, type RowAction } from "@/components/data-table";
import { DataList } from "@/components/data-list";
import { AddButton } from "@/components/add-button";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import type { Medicine } from "@/lib/types";
import { MedicineForm } from "@/components/forms/medicine-form";
import { usePermissions } from "@/hooks/use-permissions";

export function MedicinesPanel() {
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Medicine | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaved = () => setRefreshKey((k) => k + 1);

  const handleDelete = async (m: Medicine) => {
    if (!confirm(`Delete medicine "${m.name}"?`)) return;
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
      render: (m) => <span className="font-medium">{m.name}</span>,
    },
    { key: "desc", header: "Description", render: (m) => m.description || "—" },
  ];

  const actions: RowAction<Medicine>[] = [
    ...(can("patients:write")
      ? [{
          label: "Edit",
          icon: <Pencil className="size-3.5" />,
          onClick: (m: Medicine) => {
            setEditing(m);
            setFormOpen(true);
          },
        }]
      : []),
    ...(can("patients:delete")
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
          can("patients:write") ? (
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
