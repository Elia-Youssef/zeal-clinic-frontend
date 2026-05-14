
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { type Column, type RowAction } from "@/components/data/data-table";
import { DataList } from "@/components/data/data-list";
import { AddButton } from "@/components/shared/add-button";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import type { Allergy } from "@/lib/types";
import { AllergyForm } from "@/components/forms/allergy-form";
import { usePermissions } from "@/hooks/use-permissions";
import { useConfirm } from "@/hooks/use-confirm";

export default function AllergiesPage() {
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const confirm = useConfirm();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Allergy | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaved = () => setRefreshKey((k) => k + 1);

  const handleDelete = async (a: Allergy) => {
    if (
      !(await confirm({
        title: "Delete allergy?",
        description: `Delete allergy "${a.name}"?`,
        confirmText: "Delete",
      }))
    ) {
      return;
    }
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
      sortable: true,
      sortKey: "name",
      render: (a) => <span className="font-medium">{a.name}</span>,
    },
    { key: "desc", header: "Description", render: (a) => a.description || "---" },
  ];

  const actions: RowAction<Allergy>[] = [
    ...(can("allergies:write")
      ? [{
          label: "Edit",
          icon: <Pencil className="size-3.5" />,
          onClick: (a: Allergy) => {
            setEditing(a);
            setFormOpen(true);
          },
        }]
      : []),
    ...(can("allergies:delete")
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
          can("allergies:write") ? (
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
