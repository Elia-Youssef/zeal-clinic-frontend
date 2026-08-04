import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { DateInput } from "@/components/shared/date-input";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { FormDraftsLayout } from "@/components/shared/form-drafts";
import { textareaClass } from "@/lib/form-styles";
import { api, toISODate } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage, clampNonNegative, isUnder18 } from "@/lib/utils";
import { genderOptions, bloodTypeOptions } from "@/lib/constants";
import type { Patient } from "@/lib/types";
import { usePermissions } from "@/hooks/use-permissions";
import { useConfirm } from "@/hooks/use-confirm";
import { useFormDrafts } from "@/hooks/use-form-drafts";

type PatientFormFields = {
  firstName: string;
  lastName: string;
  middleName: string;
  gender: string;
  dateOfBirth: string;
  contact: string;
  email: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  weight: string;
  height: string;
  bloodType: string;
  countryId: string;
  countryName?: string;
  cityId: string;
  cityName?: string;
  address: string;
  notes: string;
  referralId: string;
  referralSource: string;
};

const emptyForm: PatientFormFields = {
  firstName: "",
  lastName: "",
  middleName: "",
  gender: "Male",
  dateOfBirth: "",
  contact: "",
  email: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  weight: "",
  height: "",
  bloodType: "",
  countryId: "",
  cityId: "",
  address: "",
  notes: "",
  referralId: "",
  referralSource: "",
};

export function PatientForm({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (created?: Record<string, unknown>) => void;
  initial?: Patient | null;
}) {
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const confirm = useConfirm();

  const [form, setForm] = useState<PatientFormFields>(emptyForm);
  const [isLebanon, setIsLebanon] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      const hasLebanonCity = !!initial.cityId;
      const cityName = initial.city
        ? [initial.city.name, initial.city.district, initial.city.governorate]
            .filter(Boolean)
            .join(", ")
        : "";
      setForm({
        firstName: initial.firstName,
        lastName: initial.lastName,
        middleName: initial.middleName ?? "",
        gender: initial.gender,
        dateOfBirth: initial.dateOfBirth?.slice(0, 10) ?? "",
        contact: initial.contact,
        email: initial.email ?? "",
        emergencyContactName: initial.emergencyContactName ?? "",
        emergencyContactPhone: initial.emergencyContactPhone ?? "",
        weight: initial.weight?.toString() ?? "",
        height: initial.height?.toString() ?? "",
        bloodType: initial.bloodType ?? "",
        countryId: initial.countryId ?? "",
        countryName: initial.country?.name ?? "",
        cityId: initial.cityId ?? "",
        cityName,
        address: initial.address ?? "",
        notes: initial.notes ?? "",
        referralId: initial.referralId ?? "",
        referralSource: initial.referralSource ?? "",
      });
      setIsLebanon(hasLebanonCity || initial.country?.name === "Lebanon");
    } else {
      setForm(emptyForm);
      setIsLebanon(false);
    }
  }, [open, initial]);

  const update = (field: keyof PatientFormFields, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // Autosave drafts for new patients only (not when editing an existing one).
  const applyDraft = useCallback((d: PatientFormFields) => {
    setForm(d);
    setIsLebanon(d.countryName === "Lebanon" || !!d.cityId);
  }, []);

  const drafts = useFormDrafts<PatientFormFields>({
    group: isEdit ? undefined : "patient",
    mode: "auto",
    open,
    snapshot: form,
    apply: applyDraft,
    blank: () => {
      setForm(emptyForm);
      setIsLebanon(false);
    },
    // gender defaults to "Male"; country/cityName are labels that mirror their ids.
    isEmpty: ({ gender: _g, countryName: _cn, cityName: _ccn, ...rest }) =>
      Object.values(rest).every((v) => !v),
    label: (d) => `${d.firstName} ${d.lastName}`.trim() || "Untitled patient",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isEdit) {
      const optionalFields = [
        form.weight,
        form.height,
        form.countryId,
      ];
      const filledCount = optionalFields.filter((v) => v && v.trim()).length;
      if (filledCount <= 1) {
        const ok = await confirm({
          title: "Create patient with minimal info?",
          description:
            "Some optional fields are empty. Are you sure you want to create this patient?",
          confirmText: "Create",
          variant: "default",
        });
        if (!ok) return;
      }
    }

    setSubmitting(true);

    const payload: Record<string, unknown> = {
      firstName: form.firstName,
      lastName: form.lastName,
      gender: form.gender,
      contact: form.contact,
      cityId: isLebanon ? form.cityId : "",
      countryId: form.countryId,
    };
    if (isEdit || form.middleName) payload.middleName = form.middleName;
    if (isEdit || form.dateOfBirth)
      payload.dateOfBirth = form.dateOfBirth ? toISODate(form.dateOfBirth) : "";
    if (isEdit || form.email) payload.email = form.email;
    if (isEdit || form.emergencyContactName)
      payload.emergencyContactName = form.emergencyContactName;
    if (isEdit || form.emergencyContactPhone)
      payload.emergencyContactPhone = form.emergencyContactPhone;
    if (isEdit || form.weight)
      payload.weight = form.weight ? Number(form.weight) : 0;
    if (isEdit || form.height)
      payload.height = form.height ? Number(form.height) : 0;
    if (isEdit || form.bloodType) payload.bloodType = form.bloodType;
    if (isEdit || form.address) payload.address = form.address;
    if (isEdit || form.notes) payload.notes = form.notes;
    if (isEdit || form.referralId) payload.referralId = form.referralId;
    if (isEdit || form.referralSource)
      payload.referralSource = form.referralSource;

    try {
      if (isEdit) {
        await api.put(`/patients/${initial!.id}`, payload);
        addAlert("success", "Patient updated.");
        onSaved();
      } else {
        const created = await api.post<Record<string, unknown>>(
          "/patients",
          payload,
        );
        addAlert("success", "Patient created.");
        drafts.discardActive();
        onSaved(created);
      }
      onClose();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const formEl = (
    <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">First Name *</label>
            <Input
              value={form.firstName}
              onChange={(e) => update("firstName", e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Middle Name</label>
            <Input
              value={form.middleName}
              onChange={(e) => update("middleName", e.target.value)}
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
            <label className="text-sm font-medium">Gender *</label>
            <SearchableDropdown
              value={form.gender}
              onChange={(v) => update("gender", v)}
              options={genderOptions}
              placeholder="Select gender…"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Date of Birth</label>
            <DateInput
              value={form.dateOfBirth}
              onChange={(v) => update("dateOfBirth", v)}
            />
            {isUnder18(form.dateOfBirth) && (
              <p className="text-xs text-warning">
                Patient is under 18 years old.
              </p>
            )}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Emergency Contact Name
            </label>
            <Input
              value={form.emergencyContactName}
              onChange={(e) => update("emergencyContactName", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Emergency Contact Phone
            </label>
            <Input
              value={form.emergencyContactPhone}
              onChange={(e) => update("emergencyContactPhone", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Weight (kg)</label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={form.weight}
              onChange={(e) => update("weight", clampNonNegative(e.target.value))}
              placeholder="e.g. 70"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Height (cm)</label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={form.height}
              onChange={(e) => update("height", clampNonNegative(e.target.value))}
              placeholder="e.g. 170"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Blood Type</label>
            <SearchableDropdown
              value={form.bloodType}
              onChange={(v) => update("bloodType", v)}
              options={bloodTypeOptions}
              placeholder="Select…"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Country</label>
            <SearchableDropdown
              value={form.countryId}
              defaultApiOption={
                form.countryName
                  ? { value: form.countryId, label: form.countryName }
                  : undefined
              }
              apiEndpoint="/countries/dropdown"
              onChange={(v) => update("countryId", v)}
              mapItem={(item) => ({ value: item.id, label: item.name })}
              onSelectItem={(i) => {
                const selectedLebanon = i.label === "Lebanon";
                setIsLebanon(selectedLebanon);
                update("countryName", i.label);
                if (!selectedLebanon) {
                  update("cityId", "");
                  update("cityName", "");
                }
              }}
            />
          </div>
          {isLebanon ? (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">City</label>
                <SearchableDropdown
                  value={form.cityId}
                  defaultApiOption={
                    form.cityName
                      ? { value: form.cityId, label: form.cityName }
                      : undefined
                  }
                  apiEndpoint="/lebanon-cities/dropdown"
                  onChange={(v) => update("cityId", v)}
                  mapItem={(item) => ({ value: item.id, label: item.name })}
                  onSelectItem={(i) => update("cityName", i.label)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Details</label>
                <Input
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  placeholder="Street address"
                />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Details</label>
              <Input
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
                placeholder="Street address"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Referred By</label>
            <SearchableDropdown
              value={form.referralId}
              apiEndpoint="/patients/dropdown"
              onChange={(v) => update("referralId", v)}
              mapItem={(item) => ({ value: item.id, label: item.name })}
              placeholder="Select patient…"
              renderAddForm={
                can("patients:write")
                  ? ({ open: addOpen, onClose: closeAdd, onCreated }) => (
                      <PatientForm
                        open={addOpen}
                        onClose={closeAdd}
                        onSaved={(created) => {
                          if (created) {
                            onCreated(
                              String(created.id),
                              `${created.firstName ?? ""} ${
                                created.lastName ?? ""
                              }`.trim(),
                            );
                          }
                        }}
                      />
                    )
                  : undefined
              }
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Referral Source</label>
            <Input
              value={form.referralSource}
              onChange={(e) => update("referralSource", e.target.value)}
              placeholder="e.g. Social media, Walk-in…"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Notes</label>
          <textarea
            className={textareaClass}
            rows={2}
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="Optional notes…"
          />
        </div>

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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Patient" : "New Patient"}
      size={drafts.enabled ? "wide" : "default"}
    >
      <FormDraftsLayout drafts={drafts}>{formEl}</FormDraftsLayout>
    </Modal>
  );
}
