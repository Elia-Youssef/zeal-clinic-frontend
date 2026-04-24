"use client";

import { useEffect, useState } from "react";
import { Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";

const VOUCHER_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length = 10) {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += VOUCHER_CHARS[Math.floor(Math.random() * VOUCHER_CHARS.length)];
  }
  return out;
}

export function DiscountVoucherForm({
  open,
  onClose,
  onSaved,
  discountId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  discountId: string;
}) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode("");
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/discounts/${discountId}/vouchers`, {
        code: code.trim(),
      });
      addAlert("success", "Voucher added.");
      onSaved();
      onClose();
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Voucher">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Code *</label>
          <div className="flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="SUMMER25"
              className="flex-1 font-mono"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Generate random code"
              onClick={() => setCode(randomCode())}
            >
              <Shuffle className="size-4" />
            </Button>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting || !code.trim()}>
            {submitting ? "Saving…" : "Add"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
