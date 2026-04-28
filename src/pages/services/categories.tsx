
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { type Column, type RowAction } from "@/components/data/data-table";
import { DataList } from "@/components/data/data-list";
import { AddButton } from "@/components/shared/add-button";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import type { ProcedureCategory } from "@/lib/types";
import { ProcedureCategoryForm } from "@/components/forms/procedure-category-form";
import { usePermissions } from "@/hooks/use-permissions";
import { useConfirm } from "@/hooks/use-confirm";

export default function CategoriesPage() {
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const confirm = useConfirm();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProcedureCategory | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaved = () => setRefreshKey((k) => k + 1);

  const handleDelete = async (c: ProcedureCategory) => {
    if (
      !(await confirm({
        title: "Delete category?",
        description: `Delete category "${c.name}"?`,
        confirmText: "Delete",
      }))
    ) {
      return;
    }
    try {
      await api.del(`/procedure-categories/${c.id}`);
      addAlert("success", "Category deleted.");
      handleSaved();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  const columns: Column<ProcedureCategory>[] = [
    { key: "name", header: "Name", render: (c) => <span className="font-medium">{c.name}</span> },
    {
      key: "parent",
      header: "Parent",
      render: (c) => c.parent?.name || "—",
    },
    { key: "desc", header: "Description", render: (c) => c.description || "—" },
  ];

  const actions: RowAction<ProcedureCategory>[] = [
    ...(can("services:write")
      ? [{
          label: "Edit",
          icon: <Pencil className="size-3.5" />,
          onClick: (c: ProcedureCategory) => { setEditing(c); setFormOpen(true); },
        }]
      : []),
    ...(can("services:delete")
      ? [{
          label: "Delete",
          icon: <Trash2 className="size-3.5" />,
          destructive: true,
          onClick: (c: ProcedureCategory) => handleDelete(c),
        }]
      : []),
  ];

  return (
    <>
      <DataList<ProcedureCategory>
        title="Procedure Categories"
        endpoint="/procedure-categories"
        columns={columns}
        actions={actions}
        rowKey={(c) => c.id}
        emptyMessage="No procedure categories defined."
        headerActions={
          can("services:write") ? (
            <AddButton label="Add Category" onClick={() => { setEditing(undefined); setFormOpen(true); }} />
          ) : undefined
        }
        refreshKey={refreshKey}
      />
      <ProcedureCategoryForm
        key={editing?.id ?? "new"}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
        initial={editing}
      />
    </>
  );
}
