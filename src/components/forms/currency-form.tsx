
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import type { Currency } from "@/lib/types";

export function CurrencyForm({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: Currency;
}) {
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [exchangeRate, setExchangeRate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode(initial?.code ?? "");
    setName(initial?.name ?? "");
    setSymbol(initial?.symbol ?? "");
    setExchangeRate(initial?.exchangeRate?.toString() ?? "");
  }, [open, initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEdit) {
        await api.put(`/currencies/${initial.id}`, { code, name, symbol, exchangeRate: Number(exchangeRate) });
        addAlert("success", "Currency updated.");
      } else {
        await api.post("/currencies", { code, name, symbol, exchangeRate: Number(exchangeRate) });
        addAlert("success", "Currency created.");
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
      title={isEdit ? "Edit Currency" : "New Currency"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Code *</label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="USD"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Name *</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="US Dollar"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Symbol *</label>
            <Input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="$"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Exchange Rate *</label>
            <Input
              type="number"
              step="any"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              placeholder="1.00"
              required
            />
          </div>
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
