import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Modal } from "@/components/shared/modal";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import { roomTypeOptions } from "@/lib/constants";
import type { Room } from "@/lib/types";

export function RoomForm({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: Room;
}) {
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<string>(initial?.type ?? "General");
  const [isAvailable, setIsAvailable] = useState(initial?.isAvailable ?? true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setType(initial?.type ?? "General");
    setIsAvailable(initial?.isAvailable ?? true);
  }, [open, initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = { name, type, isAvailable };
    try {
      if (isEdit) {
        await api.put(`/rooms/${initial.id}`, payload);
        addAlert("success", "Room updated.");
      } else {
        await api.post("/rooms", payload);
        addAlert("success", "Room created.");
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
      title={isEdit ? "Edit Room" : "New Room"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Name *</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Type *</label>
          <SearchableDropdown
            value={type}
            onChange={setType}
            options={roomTypeOptions}
            placeholder="Select type…"
            required
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="roomAvail"
            checked={isAvailable}
            onCheckedChange={(value) => setIsAvailable(value)}
          />
          <label htmlFor="roomAvail" className="text-sm font-medium">
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
    </Modal>
  );
}
