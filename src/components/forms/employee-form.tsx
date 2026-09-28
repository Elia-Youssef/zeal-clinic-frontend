import { useState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/shared/modal";
import { FormField } from "@/components/shared/form-field";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { api, toISODate } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage, isUnder18 } from "@/lib/utils";
import { employmentTypeOptions, userRoleOptions } from "@/lib/constants";
import type { Employee } from "@/lib/types";
import { DateInput } from "@/components/shared/date-input";

type EmployeeFormFields = {
  firstName: string;
  lastName: string;
  role: string;
  contact: string;
  email: string;
  dateOfBirth: string;
  employmentType: string;
  username: string;
  password: string;
  userRole: string;
};

const emptyForm: EmployeeFormFields = {
  firstName: "",
  lastName: "",
  role: "",
  contact: "",
  email: "",
  dateOfBirth: "",
  employmentType: "Full-time",
  username: "",
  password: "",
  userRole: "staff",
};

/** The editable fields of an existing employee (account fields start blank). */
function fieldsOfEmployee(initial: Employee): EmployeeFormFields {
  return {
    firstName: initial.firstName,
    lastName: initial.lastName,
    role: initial.role,
    contact: initial.contact,
    email: initial.email ?? "",
    dateOfBirth: initial.dateOfBirth?.slice(0, 10) ?? "",
    employmentType: initial.employmentType,
    username: "",
    password: "",
    userRole: "staff",
  };
}

type EmployeeFormProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (created?: Record<string, unknown>) => void;
  initial?: Employee | null;
};

export function EmployeeForm({ open, ...props }: EmployeeFormProps) {
  const isEdit = !!props.initial;
  return (
    <Modal
      open={open}
      onClose={props.onClose}
      title={isEdit ? "Edit Employee" : "New Employee"}
    >
      <EmployeeFormBody {...props} />
    </Modal>
  );
}

function EmployeeFormBody({
  onClose,
  onSaved,
  initial,
}: Omit<EmployeeFormProps, "open">) {
  const createUserFieldId = useId();
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const [form, setForm] = useState<EmployeeFormFields>(() =>
    initial ? fieldsOfEmployee(initial) : emptyForm,
  );
  const [createUser, setCreateUser] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const update = (field: keyof EmployeeFormFields, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      firstName: form.firstName,
      lastName: form.lastName,
      role: form.role,
      contact: form.contact,
      employmentType: form.employmentType,
    };
    if (isEdit || form.email) payload.email = form.email;
    if (isEdit || form.dateOfBirth)
      payload.dateOfBirth = form.dateOfBirth ? toISODate(form.dateOfBirth) : "";
    if (!isEdit && createUser) {
      payload.username = form.username;
      payload.password = form.password;
      if (form.userRole) payload.userRole = form.userRole;
    }

    try {
      if (isEdit) {
        await api.put(`/employees/${initial!.id}`, payload);
        addAlert("success", "Employee updated.");
        onSaved();
      } else {
        const created = await api.post<Record<string, unknown>>(
          "/employees",
          payload,
        );
        addAlert("success", "Employee created.");
        onSaved(created);
      }
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
        <FormField label="First Name" required>
          {({ id }) => (
            <Input
              id={id}
              value={form.firstName}
              onChange={(e) => update("firstName", e.target.value)}
              required
            />
          )}
        </FormField>
        <FormField label="Last Name" required>
          {({ id }) => (
            <Input
              id={id}
              value={form.lastName}
              onChange={(e) => update("lastName", e.target.value)}
              required
            />
          )}
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Role" required>
          {({ id }) => (
            <Input
              id={id}
              value={form.role}
              onChange={(e) => update("role", e.target.value)}
              placeholder="e.g. Doctor, Nurse, Secretary"
              required
            />
          )}
        </FormField>
        <FormField label="Employment Type" required>
          {({ id }) => (
            <SearchableDropdown
              id={id}
              value={form.employmentType}
              onChange={(v) => update("employmentType", v)}
              options={employmentTypeOptions}
              placeholder="Select type…"
              required
            />
          )}
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Contact" required>
          {({ id }) => (
            <Input
              id={id}
              value={form.contact}
              onChange={(e) => update("contact", e.target.value)}
              placeholder="Phone number"
              required
            />
          )}
        </FormField>
        <FormField label="Email">
          {({ id }) => (
            <Input
              id={id}
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
            />
          )}
        </FormField>
      </div>

      <FormField label="Date of Birth" group>
        {({ labelId }) => (
          <>
            <DateInput
              labelId={labelId}
              value={form.dateOfBirth}
              onChange={(v) => update("dateOfBirth", v)}
            />
            {isUnder18(form.dateOfBirth) && (
              <p className="text-xs text-warning">
                Employee is under 18 years old.
              </p>
            )}
          </>
        )}
      </FormField>

      {!isEdit && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id={createUserFieldId}
              checked={createUser}
              onCheckedChange={(value) => setCreateUser(value)}
            />
            <label
              htmlFor={createUserFieldId}
              className="text-sm font-medium"
            >
              Create Staff Account
            </label>
          </div>

          {createUser && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <FormField label="Username" required>
                {({ id }) => (
                  <Input
                    id={id}
                    value={form.username}
                    onChange={(e) => update("username", e.target.value)}
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
                  />
                )}
              </FormField>
              <FormField label="Staff Role">
                {({ id }) => (
                  <SearchableDropdown
                    id={id}
                    value={form.userRole}
                    onChange={(v) => update("userRole", v)}
                    options={userRoleOptions}
                    placeholder="Select role…"
                  />
                )}
              </FormField>
            </div>
          )}
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
