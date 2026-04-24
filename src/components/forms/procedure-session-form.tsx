"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import type { ProcedureSession } from "@/lib/types";

export function ProcedureSessionForm({
  open,
  onClose,
  onSaved,
  procedureId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  procedureId: string;
}) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [nextSessionNumber, setNextSessionNumber] = useState<number | null>(
    null,
  );

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setPrice("");
    setNextSessionNumber(null);
    api
      .get<ProcedureSession[]>(`/procedures/${procedureId}/sessions`)
      .then((s) => setNextSessionNumber((s?.length ?? 0) + 1))
      .catch(() => setNextSessionNumber(1));
  }, [open, procedureId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price || nextSessionNumber == null) return;
    setSubmitting(true);
    try {
      await api.post(`/procedures/${procedureId}/sessions`, {
        sessionNumber: nextSessionNumber,
        name,
        description: description || undefined,
        price: Number(price),
      });
      addAlert("success", "Session added.");
      onSaved();
      onClose();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Session">
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
          <label className="text-sm font-medium">Description</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Price *</label>
          <Input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              submitting || !name || !price || nextSessionNumber == null
            }
          >
            {submitting ? "Saving…" : "Add"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
