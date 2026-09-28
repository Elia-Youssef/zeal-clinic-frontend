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
import { roomTypeOptions } from "@/lib/constants";
import type { Room } from "@/lib/types";

type RoomFormProps = {
  open: boolean;
  onClose: () => void;
  onSaved: (created?: Record<string, unknown>) => void;
  initial?: Room;
};

export function RoomForm({ open, ...props }: RoomFormProps) {
  const isEdit = !!props.initial;
  return (
    <Modal
      open={open}
      onClose={props.onClose}
      title={isEdit ? "Edit Room" : "New Room"}
    >
      <RoomFormBody {...props} />
    </Modal>
  );
}

function RoomFormBody({
  onClose,
  onSaved,
  initial,
}: Omit<RoomFormProps, "open">) {
  const availableFieldId = useId();
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<string>(initial?.type ?? "General");
  const [isAvailable, setIsAvailable] = useState(initial?.isAvailable ?? true);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = { name, type, isAvailable };
    try {
      if (isEdit) {
        await api.put(`/rooms/${initial.id}`, payload);
        addAlert("success", "Room updated.");
        onSaved();
      } else {
        const created = await api.post<Record<string, unknown>>(
          "/rooms",
          payload,
        );
        addAlert("success", "Room created.");
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
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        )}
      </FormField>
      <FormField label="Type" required>
        {({ id }) => (
          <SearchableDropdown
            id={id}
            value={type}
            onChange={setType}
            options={roomTypeOptions}
            placeholder="Select type…"
            required
          />
        )}
      </FormField>
      <div className="flex items-center gap-2">
        <Checkbox
          id={availableFieldId}
          checked={isAvailable}
          onCheckedChange={(value) => setIsAvailable(value)}
        />
        <label htmlFor={availableFieldId} className="text-sm font-medium">
          Available
        </label>
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
}
