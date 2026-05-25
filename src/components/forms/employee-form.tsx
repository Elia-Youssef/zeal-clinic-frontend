
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/shared/modal";
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
  userRole: "user",
};

export function EmployeeForm({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (created?: Record<string, unknown>) => void;
  initial?: Employee | null;
}) {
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const [form, setForm] = useState<EmployeeFormFields>(emptyForm);
  const [createUser, setCreateUser] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        firstName: initial.firstName,
        lastName: initial.lastName,
        role: initial.role,
        contact: initial.contact,
        email: initial.email ?? "",
        dateOfBirth: initial.dateOfBirth?.slice(0, 10) ?? "",
        employmentType: initial.employmentType,
        username: "",
        password: "",
        userRole: "user",
      });
      setCreateUser(false);
    } else {
      setForm(emptyForm);
      setCreateUser(false);
    }
  }, [open, initial]);

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
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Employee" : "New Employee"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">First Name *</label>
            <Input
              value={form.firstName}
              onChange={(e) => update("firstName", e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Last Name *</label>
            <Input
              value={form.lastName}
              onChange={(e) => update("lastName", e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Role *</label>
            <Input
              value={form.role}
              onChange={(e) => update("role", e.target.value)}
              placeholder="e.g. Doctor, Nurse, Secretary"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Employment Type *</label>
            <SearchableDropdown
              value={form.employmentType}
              onChange={(v) => update("employmentType", v)}
              options={employmentTypeOptions}
              placeholder="Select type…"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Contact *</label>
            <Input
              value={form.contact}
              onChange={(e) => update("contact", e.target.value)}
              placeholder="Phone number"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Date of Birth</label>
          <DateInput
            value={form.dateOfBirth}
            onChange={(v) => update("dateOfBirth", v)}
          />
          {isUnder18(form.dateOfBirth) && (
            <p className="text-xs text-warning">
              Employee is under 18 years old.
            </p>
          )}
        </div>

        {!isEdit && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="employeeCreateUser"
                checked={createUser}
                onCheckedChange={(value) => setCreateUser(value)}
              />
              <label
                htmlFor="employeeCreateUser"
                className="text-sm font-medium"
              >
                Create Staff Account
              </label>
            </div>

            {createUser && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Username *</label>
                  <Input
                    value={form.username}
                    onChange={(e) => update("username", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Password *</label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Staff Role</label>
                  <SearchableDropdown
                    value={form.userRole}
                    onChange={(v) => update("userRole", v)}
                    options={userRoleOptions}
                    placeholder="Select role…"
                  />
                </div>
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
    </Modal>
  );
}
