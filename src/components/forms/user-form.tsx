import { useState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/shared/modal";
import { FormField } from "@/components/shared/form-field";
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
  role: "staff",
  password: "",
  isActive: true,
};

/** The editable fields of an existing staff account (password starts blank). */
function fieldsOfUser(initial: User): UserFormFields {
  return {
    username: initial.username,
    displayName: initial.displayName,
    role: initial.role,
    password: "",
    isActive: initial.isActive,
  };
}

type UserFormProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: User | null;
};

export function UserForm({ open, ...props }: UserFormProps) {
  const isEdit = !!props.initial;
  return (
    <Modal
      open={open}
      onClose={props.onClose}
      title={isEdit ? "Edit Staff" : "New Staff"}
    >
      <UserFormBody {...props} />
    </Modal>
  );
}

function UserFormBody({
  onClose,
  onSaved,
  initial,
}: Omit<UserFormProps, "open">) {
  const activeFieldId = useId();
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const [form, setForm] = useState<UserFormFields>(() =>
    initial ? fieldsOfUser(initial) : emptyForm,
  );
  const [submitting, setSubmitting] = useState(false);

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Username" required>
          {({ id }) => (
            <Input
              id={id}
              value={form.username}
              onChange={(e) => update("username", e.target.value)}
              required
              disabled={isEdit}
            />
          )}
        </FormField>
        <FormField label="Display Name" required>
          {({ id }) => (
            <Input
              id={id}
              value={form.displayName}
              onChange={(e) => update("displayName", e.target.value)}
              required
            />
          )}
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Role" required>
          {({ id }) => (
            <SearchableDropdown
              id={id}
              value={form.role}
              onChange={(v) => update("role", v)}
              options={userRoleOptions}
              placeholder="Select role…"
              required
            />
          )}
        </FormField>
        <FormField label="Password">
          {({ id }) => (
            <Input
              id={id}
              type="password"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              placeholder={isEdit ? "Leave blank to keep" : ""}
            />
          )}
        </FormField>
      </div>

      {isEdit && (
        <div className="flex items-center gap-2">
          <Checkbox
            id={activeFieldId}
            checked={form.isActive}
            onCheckedChange={(value) => update("isActive", value)}
          />
          <label htmlFor={activeFieldId} className="text-sm font-medium">
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
  );
}
