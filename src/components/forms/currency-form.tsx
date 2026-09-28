import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { FormField } from "@/components/shared/form-field";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage, clampNonNegative, round2 } from "@/lib/utils";
import type { Currency } from "@/lib/types";

type CurrencyFormProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: Currency;
};

export function CurrencyForm({ open, ...props }: CurrencyFormProps) {
  const isEdit = !!props.initial;
  return (
    <Modal
      open={open}
      onClose={props.onClose}
      title={isEdit ? "Edit Currency" : "New Currency"}
    >
      <CurrencyFormBody {...props} />
    </Modal>
  );
}

function CurrencyFormBody({
  onClose,
  onSaved,
  initial,
}: Omit<CurrencyFormProps, "open">) {
  const isEdit = !!initial;
  const addAlert = useAlertStore((s) => s.addAlert);
  const [code, setCode] = useState(initial?.code ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [symbol, setSymbol] = useState(initial?.symbol ?? "");
  const [exchangeRate, setExchangeRate] = useState(
    initial?.exchangeRate?.toString() ?? "",
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isEdit) {
        await api.put(`/currencies/${initial.id}`, { code, name, symbol, exchangeRate: round2(Number(exchangeRate)) });
        addAlert("success", "Currency updated.");
      } else {
        await api.post("/currencies", { code, name, symbol, exchangeRate: round2(Number(exchangeRate)) });
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-3">
        <FormField label="Code" required>
          {({ id }) => (
            <Input
              id={id}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="USD"
              required
              disabled={isEdit}
            />
          )}
        </FormField>
        <FormField label="Name" required>
          {({ id }) => (
            <Input
              id={id}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="US Dollar"
              required
            />
          )}
        </FormField>
        <FormField label="Symbol" required>
          {({ id }) => (
            <Input
              id={id}
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="$"
              required
            />
          )}
        </FormField>
        <FormField label="Exchange Rate" required>
          {({ id }) => (
            <Input
              id={id}
              type="number"
              step="any"
              value={exchangeRate}
              onChange={(e) => setExchangeRate(clampNonNegative(e.target.value))}
              placeholder="1.00"
              required
            />
          )}
        </FormField>
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
