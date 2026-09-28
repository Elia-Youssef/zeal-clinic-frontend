import { useState, KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { FormField } from "@/components/shared/form-field";
import { textareaClass } from "@/lib/form-styles";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import type { Supplier } from "@/lib/types";

type SupplierFormFields = {
  name: string;
  contacts: string[];
  emails: string[];
  address: string;
  notes: string;
};

const emptyForm: SupplierFormFields = {
  name: "",
  contacts: [],
  emails: [],
  address: "",
  notes: "",
};

const splitCsv = (value: string | null | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** The editable fields of an existing supplier. */
function fieldsOfSupplier(initial: Supplier): SupplierFormFields {
  return {
    name: initial.name,
    contacts: splitCsv(initial.contact),
    emails: splitCsv(initial.email),
    address: initial.address ?? "",
    notes: initial.notes ?? "",
  };
}

function TagsInput({
  id,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  id?: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  type?: "text" | "email";
}) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !value.includes(s));
    if (parts.length) onChange([...value, ...parts]);
    setDraft("");
  };

  const removeAt = (idx: number) =>
    onChange(value.filter((_, i) => i !== idx));

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (draft.trim()) commit(draft);
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      e.preventDefault();
      removeAt(value.length - 1);
    }
  };

  return (
    <div className="space-y-1.5">
      <Input
        id={id}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (draft.trim()) commit(draft);
        }}
        placeholder={placeholder}
      />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((tag, idx) => (
            <span
              key={`${tag}-${idx}`}
              className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="rounded-sm hover:bg-muted-foreground/20"
                aria-label={`Remove ${tag}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

type SupplierFormProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (created?: Record<string, unknown>) => void;
  initial?: Supplier | null;
};

export function SupplierForm({ open, ...props }: SupplierFormProps) {
  const isEdit = !!props.initial;
  return (
    <Modal
      open={open}
      onClose={props.onClose}
      title={isEdit ? "Edit Supplier" : "New Supplier"}
    >
      <SupplierFormBody {...props} />
    </Modal>
  );
}

function SupplierFormBody({
  onClose,
  onSaved,
  initial,
}: Omit<SupplierFormProps, "open">) {
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);

  const [form, setForm] = useState<SupplierFormFields>(() =>
    initial ? fieldsOfSupplier(initial) : emptyForm,
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const contact = form.contacts.join(", ");
    const email = form.emails.join(", ");

    const payload: Record<string, unknown> = {
      name: form.name,
    };
    if (isEdit || contact) payload.contact = contact;
    if (isEdit || email) payload.email = email;
    if (isEdit || form.address) payload.address = form.address;
    if (isEdit || form.notes) payload.notes = form.notes;

    try {
      if (isEdit) {
        await api.put(`/suppliers/${initial!.id}`, payload);
        addAlert("success", "Supplier updated.");
        onSaved();
      } else {
        const created = await api.post<Record<string, unknown>>("/suppliers", payload);
        addAlert("success", "Supplier created.");
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
      <FormField label="Name" required>
        {({ id }) => (
          <Input
            id={id}
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Supplier name"
            required
          />
        )}
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField label="Contacts">
          {({ id }) => (
            <TagsInput
              id={id}
              value={form.contacts}
              onChange={(contacts) => setForm((p) => ({ ...p, contacts }))}
              placeholder="Phone number, press Enter"
            />
          )}
        </FormField>
        <FormField label="Emails">
          {({ id }) => (
            <TagsInput
              id={id}
              type="email"
              value={form.emails}
              onChange={(emails) => setForm((p) => ({ ...p, emails }))}
              placeholder="email@example.com, press Enter"
            />
          )}
        </FormField>
      </div>

      <FormField label="Address">
        {({ id }) => (
          <Input
            id={id}
            value={form.address}
            onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
            placeholder="Address"
          />
        )}
      </FormField>

      <FormField label="Notes">
        {({ id }) => (
          <textarea
            id={id}
            className={textareaClass}
            rows={2}
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            placeholder="Optional notes…"
          />
        )}
      </FormField>

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
