import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { type Column, type RowAction } from "@/components/data/data-table";
import { DataList } from "@/components/data/data-list";
import { AddButton } from "@/components/shared/add-button";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import type { ProcedureType } from "@/lib/types";
import { ProcedureTypeForm } from "@/components/forms/procedure-type-form";
import { usePermissions } from "@/hooks/use-permissions";
import { useConfirm } from "@/hooks/use-confirm";

export default function TypesPage() {
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const confirm = useConfirm();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProcedureType | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaved = () => setRefreshKey((k) => k + 1);

  const handleDelete = async (t: ProcedureType) => {
    if (
      !(await confirm({
        title: "Delete procedure type?",
        description: `Delete procedure type "${t.name}"?`,
        confirmText: "Delete",
      }))
    ) {
      return;
    }
    try {
      await api.del(`/procedure-types/${t.id}`);
      addAlert("success", "Procedure type deleted.");
      handleSaved();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  const columns: Column<ProcedureType>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      sortKey: "name",
      render: (t) => <span className="font-medium">{t.name}</span>,
    },
    {
      key: "desc",
      header: "Description",
      render: (t) => t.description || "---",
    },
  ];

  const actions: RowAction<ProcedureType>[] = [
    ...(can("procedure-types:write")
      ? [
          {
            label: "Edit",
            icon: <Pencil className="size-3.5" />,
            onClick: (t: ProcedureType) => {
              setEditing(t);
              setFormOpen(true);
            },
          },
        ]
      : []),
    ...(can("procedure-types:write")
      ? [
          {
            label: "Delete",
            icon: <Trash2 className="size-3.5" />,
            destructive: true,
            onClick: (t: ProcedureType) => handleDelete(t),
          },
        ]
      : []),
  ];

  return (
    <>
      <DataList<ProcedureType>
        title="Procedure Types"
        endpoint="/procedure-types"
        columns={columns}
        actions={actions}
        rowKey={(t) => t.id}
        emptyMessage="No procedure types defined."
        headerActions={
          can("procedure-types:write") ? (
            <AddButton
              label="Add Type"
              onClick={() => {
                setEditing(undefined);
                setFormOpen(true);
              }}
            />
          ) : undefined
        }
        refreshKey={refreshKey}
      />
      <ProcedureTypeForm
        key={editing?.id ?? "new"}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
        initial={editing}
      />
    </>
  );
}
