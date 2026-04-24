"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { type Column, type RowAction } from "@/components/data/data-table";
import { DataList } from "@/components/data/data-list";
import { AddButton } from "@/components/shared/add-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { api } from "@/lib/api";
import { textareaClass } from "@/lib/form-styles";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import type { ProcedureCategory } from "@/lib/types";
import { usePermissions } from "@/hooks/use-permissions";

function ProcedureCategoryForm({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: ProcedureCategory;
}) {
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const [name, setName] = useState(initial?.name ?? "");
  const [desc, setDesc] = useState(initial?.description ?? "");
  const [parentId, setParentId] = useState(initial?.parentId ?? "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload: Record<string, unknown> = { name, description: desc || undefined };
    if (parentId) payload.parentId = parentId;
    try {
      if (isEdit) {
        await api.put(`/procedure-categories/${initial.id}`, payload);
        addAlert("success", "Category updated.");
      } else {
        await api.post("/procedure-categories", payload);
        addAlert("success", "Category created.");
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
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Procedure Category" : "New Procedure Category"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Name *</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Parent Category</label>
          <SearchableDropdown
            value={parentId}
            onChange={setParentId}
            apiEndpoint="/procedure-categories/dropdown"
            mapItem={(c: { id: string; name: string }) => ({
              value: c.id,
              label: c.name,
            })}
            placeholder="None (top-level)"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Description</label>
          <textarea className={textareaClass} rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : isEdit ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ProcedureCategoriesPanel() {
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProcedureCategory | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaved = () => setRefreshKey((k) => k + 1);

  const handleDelete = async (c: ProcedureCategory) => {
    if (!confirm(`Delete category "${c.name}"?`)) return;
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

  const actions: RowAction<ProcedureCategory>[] = can("services:write")
    ? [
        {
          label: "Edit",
          icon: <Pencil className="size-3.5" />,
          onClick: (c) => { setEditing(c); setFormOpen(true); },
        },
        {
          label: "Delete",
          icon: <Trash2 className="size-3.5" />,
          destructive: true,
          onClick: (c) => handleDelete(c),
        },
      ]
    : [];

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
