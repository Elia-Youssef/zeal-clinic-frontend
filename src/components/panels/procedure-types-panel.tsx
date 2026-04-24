"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { type Column, type RowAction } from "@/components/data/data-table";
import { DataList } from "@/components/data/data-list";
import { AddButton } from "@/components/shared/add-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { api } from "@/lib/api";
import { textareaClass } from "@/lib/form-styles";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import type { ProcedureType } from "@/lib/types";
import { usePermissions } from "@/hooks/use-permissions";

function ProcedureTypeForm({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: ProcedureType;
}) {
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const [name, setName] = useState(initial?.name ?? "");
  const [desc, setDesc] = useState(initial?.description ?? "");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = { name, description: desc || undefined };
    try {
      if (isEdit) {
        await api.put(`/procedure-types/${initial.id}`, payload);
        addAlert("success", "Procedure type updated.");
      } else {
        await api.post("/procedure-types", payload);
        addAlert("success", "Procedure type created.");
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
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Procedure Type" : "New Procedure Type"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Name *</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
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

export function ProcedureTypesPanel() {
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProcedureType | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSaved = () => setRefreshKey((k) => k + 1);

  const handleDelete = async (t: ProcedureType) => {
    if (!confirm(`Delete procedure type "${t.name}"?`)) return;
    try {
      await api.del(`/procedure-types/${t.id}`);
      addAlert("success", "Procedure type deleted.");
      handleSaved();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  const columns: Column<ProcedureType>[] = [
    { key: "name", header: "Name", render: (t) => <span className="font-medium">{t.name}</span> },
    { key: "desc", header: "Description", render: (t) => t.description || "—" },
  ];

  const actions: RowAction<ProcedureType>[] = can("services:write")
    ? [
        {
          label: "Edit",
          icon: <Pencil className="size-3.5" />,
          onClick: (t) => { setEditing(t); setFormOpen(true); },
        },
        {
          label: "Delete",
          icon: <Trash2 className="size-3.5" />,
          destructive: true,
          onClick: (t) => handleDelete(t),
        },
      ]
    : [];

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
          can("services:write") ? (
            <AddButton label="Add Type" onClick={() => { setEditing(undefined); setFormOpen(true); }} />
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
