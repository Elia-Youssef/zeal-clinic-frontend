import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/shared/modal";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import { userRoleOptions } from "@/lib/constants";
import type { User } from "@/lib/types";

type UserFormFields = {
  username: string;
  displayName: string;
  role: string;
  password: string;
  isActive: boolean;
};

const emptyForm: UserFormFields = {
  username: "",
  displayName: "",
  role: "user",
  password: "",
  isActive: true,
};

export function UserForm({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: User | null;
}) {
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const [form, setForm] = useState<UserFormFields>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        username: initial.username,
        displayName: initial.displayName,
        role: initial.role,
        password: "",
        isActive: initial.isActive,
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, initial]);

  const update = (field: keyof UserFormFields, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      displayName: form.displayName,
      role: form.role,
    };
    if (!isEdit) payload.username = form.username;
    if (form.password) payload.password = form.password;
    if (isEdit) payload.isActive = form.isActive;

    try {
      if (isEdit) {
        await api.put(`/users/${initial!.id}`, payload);
        addAlert("success", "Staff member updated.");
      } else {
        await api.post("/users", { ...payload, password: form.password });
        addAlert("success", "Staff member created.");
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
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Staff" : "New Staff"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Username *</label>
            <Input
              value={form.username}
              onChange={(e) => update("username", e.target.value)}
              required
              disabled={isEdit}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Display Name *</label>
            <Input
              value={form.displayName}
              onChange={(e) => update("displayName", e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Role *</label>
            <SearchableDropdown
              value={form.role}
              onChange={(v) => update("role", v)}
              options={userRoleOptions}
              placeholder="Select role…"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Password</label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              placeholder={isEdit ? "Leave blank to keep" : ""}
            />
          </div>
        </div>

        {isEdit && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="user-isActive"
              checked={form.isActive}
              onCheckedChange={(value) => update("isActive", value)}
            />
            <label htmlFor="user-isActive" className="text-sm font-medium">
              Active
            </label>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : isEdit ? "Update" : "Create"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
