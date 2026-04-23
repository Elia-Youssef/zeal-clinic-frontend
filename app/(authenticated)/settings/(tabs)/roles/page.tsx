"use client";

import { useState } from "react";
import { Eye } from "lucide-react";
import { type Column, type RowAction } from "@/components/data-table";
import { DataList } from "@/components/data-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { textareaClass } from "@/lib/form-styles";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import type { Role } from "@/lib/types";
import { usePermissions } from "@/hooks/use-permissions";

export default function RolesPage() {
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const [refreshKey, setRefreshKey] = useState(0);

  /* Edit modal */
  const [editingRole, setEditingRole] = useState<Role | undefined>();
  const [editLabel, setEditLabel] = useState("");
  const [editScopes, setEditScopes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const openEdit = (r: Role) => {
    setEditingRole(r);
    setEditLabel(r.label);
    setEditScopes(r.scopes.join("\n"));
  };

  const handleSave = async () => {
    if (!editingRole) return;
    setSubmitting(true);
    try {
      await api.put(`/roles/${editingRole.name}`, {
        label: editLabel,
        scopes: editScopes
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      addAlert("success", "Role updated.");
      setEditingRole(undefined);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<Role>[] = [
    {
      key: "name",
      header: "Name",
      render: (r) => <span className="font-mono text-sm">{r.name}</span>,
    },
    {
      key: "label",
      header: "Label",
      render: (r) => <span className="font-medium">{r.label}</span>,
    },
    {
      key: "scopes",
      header: "Scopes",
      render: (r) => (
        <span className="text-xs text-muted-foreground">
          {r.scopes.length} scopes
        </span>
      ),
    },
  ];

  const actions: RowAction<Role>[] = can("roles:write")
    ? [
        {
          label: "Edit scopes",
          icon: <Eye className="size-3.5" />,
          onClick: (r) => openEdit(r),
        },
      ]
    : [];

  return (
    <>
      <DataList<Role>
        title="Roles"
        endpoint="/roles"
        columns={columns}
        actions={actions}
        rowKey={(r) => r.name}
        emptyMessage="No roles."
        refreshKey={refreshKey}
      />

      {editingRole && (
        <Modal
          open={!!editingRole}
          onClose={() => setEditingRole(undefined)}
          title={`Edit Role — ${editingRole.name}`}
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Label</label>
              <Input
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Scopes (one per line)
              </label>
              <textarea
                className={textareaClass}
                rows={6}
                value={editScopes}
                onChange={(e) => setEditScopes(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setEditingRole(undefined)}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={submitting}>
                {submitting ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
