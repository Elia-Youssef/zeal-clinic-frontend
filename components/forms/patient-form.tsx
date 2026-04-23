"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/modal";
import { DateInput } from "@/components/date-input";
import { SearchableDropdown } from "@/components/searchable-dropdown";
import { textareaClass } from "@/lib/form-styles";
import { api, toISODate } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import { genderOptions, bloodTypeOptions } from "@/lib/constants";
import type { Patient } from "@/lib/types";

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
  cityId: string;
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

  const [form, setForm] = useState<PatientFormFields>(emptyForm);
  const [isLebanon, setIsLebanon] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initial) {
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
        cityId: initial.cityId ?? "",
        address: initial.address ?? "",
        notes: initial.notes ?? "",
        referralId: initial.referralId ?? "",
        referralSource: initial.referralSource ?? "",
      });
    } else {
      setForm(emptyForm);
    }
  }, [initial]);

  const update = (field: keyof PatientFormFields, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      firstName: form.firstName,
      lastName: form.lastName,
      gender: form.gender,
      dateOfBirth: toISODate(form.dateOfBirth),
      contact: form.contact,
      cityId: isLebanon ? form.cityId : "",
      countryId: form.countryId,
    };
    if (form.middleName) payload.middleName = form.middleName;
    if (form.email) payload.email = form.email;
    if (form.emergencyContactName)
      payload.emergencyContactName = form.emergencyContactName;
    if (form.emergencyContactPhone)
      payload.emergencyContactPhone = form.emergencyContactPhone;
    if (form.weight) payload.weight = Number(form.weight);
    if (form.height) payload.height = Number(form.height);
    if (form.bloodType) payload.bloodType = form.bloodType;
    if (form.address) payload.address = form.address;
    if (form.notes) payload.notes = form.notes;
    if (form.referralId) payload.referralId = form.referralId;
    if (form.referralSource) payload.referralSource = form.referralSource;

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
      title={isEdit ? "Edit Patient" : "New Patient"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
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

        <div className="grid grid-cols-2 gap-3">
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
            <label className="text-sm font-medium">Date of Birth *</label>
            <DateInput
              value={form.dateOfBirth}
              onChange={(v) => update("dateOfBirth", v)}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
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

        <div className="grid grid-cols-2 gap-3">
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

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Weight (kg)</label>
            <Input
              type="number"
              step="0.1"
              value={form.weight}
              onChange={(e) => update("weight", e.target.value)}
              placeholder="e.g. 70"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Height (cm)</label>
            <Input
              type="number"
              step="0.1"
              value={form.height}
              onChange={(e) => update("height", e.target.value)}
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

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Country</label>
            <SearchableDropdown
              value={form.countryId}
              // initialOption={{
              //   value: form.countryId,
              //   label: `${initial?.country?.name}`,
              // }}
              apiEndpoint="/countries/dropdown"
              onChange={(v) => update("countryId", v)}
              mapItem={(item) => ({ value: item.id, label: item.name })}
              onSelectItem={(i) => setIsLebanon(i.label === "Lebanon")}
            />
          </div>
          {isLebanon ? (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">City</label>
                <SearchableDropdown
                  value={form.cityId}
                  // initialOption={{
                  //   value: form.cityId,
                  //   label: `${initial?.city?.governorate}, ${initial?.city?.district}, ${initial?.city?.name}`,
                  // }}
                  apiEndpoint="/lebanon-cities/dropdown"
                  onChange={(v) => update("cityId", v)}
                  mapItem={(item) => ({ value: item.id, label: item.name })}
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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Referred By</label>
            <SearchableDropdown
              value={form.referralId}
              apiEndpoint="/patients/dropdown"
              onChange={(v) => update("referralId", v)}
              mapItem={(item) => ({ value: item.id, label: item.name })}
              placeholder="Select patient…"
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
    </Modal>
  );
}
