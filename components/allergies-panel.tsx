/**
 * allergies-panel.tsx: CRUD panel for allergy definitions.
 * Used inside the Services page (Allergies tab).
 */
"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { type Column, type RowAction } from "@/components/data-table";
import { DataList } from "@/components/data-list";
import { AddButton } from "@/components/add-button";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import type { Allergy } from "@/lib/types";
import { AllergyForm } from "@/components/forms/allergy-form";
import { usePermissions } from "@/hooks/use-permissions";

export function AllergiesPanel() {
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Allergy | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaved = () => setRefreshKey((k) => k + 1);

  const handleDelete = async (a: Allergy) => {
    if (!confirm(`Delete allergy "${a.name}"?`)) return;
    try {
      await api.del(`/allergies/${a.id}`);
      addAlert("success", "Allergy deleted.");
      handleSaved();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  const columns: Column<Allergy>[] = [
    {
      key: "name",
      header: "Name",
      render: (a) => <span className="font-medium">{a.name}</span>,
    },
    { key: "desc", header: "Description", render: (a) => a.description || "—" },
  ];

  const actions: RowAction<Allergy>[] = [
    ...(can("patients:write")
      ? [{
          label: "Edit",
          icon: <Pencil className="size-3.5" />,
          onClick: (a: Allergy) => {
            setEditing(a);
            setFormOpen(true);
          },
        }]
      : []),
    ...(can("patients:delete")
      ? [{
          label: "Delete",
          icon: <Trash2 className="size-3.5" />,
          destructive: true,
          onClick: (a: Allergy) => handleDelete(a),
        }]
      : []),
  ];

  return (
    <>
      <DataList<Allergy>
        title="Allergies"
        endpoint="/allergies"
        columns={columns}
        actions={actions}
        rowKey={(a) => a.id}
        emptyMessage="No allergies defined."
        headerActions={
          can("patients:write") ? (
            <AddButton
              label="Add Allergy"
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            />
          ) : undefined
        }
        refreshKey={refreshKey}
      />
      <AllergyForm
        key={editing?.id ?? "new"}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
        initial={editing}
      />
    </>
  );
}
