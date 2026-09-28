import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/shared/modal";
import { FormField } from "@/components/shared/form-field";
import { MoneyInput } from "@/components/shared/money-input";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { textareaClass } from "@/lib/form-styles";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage, clampNonNegative, round2 } from "@/lib/utils";
import { transactionMethodOptions } from "@/lib/constants";

export type AdjustmentEntityType =
  | "patient"
  | "supplier"
  | "employee"
  | "expense";

const ENDPOINT_MAP: Record<
  AdjustmentEntityType,
  { adjustment: string; writeOff: string; idField: string }
> = {
  patient: {
    adjustment: "/client-adjustments",
    writeOff: "/client-write-offs",
    idField: "patientId",
  },
  supplier: {
    adjustment: "/supplier-adjustments",
    writeOff: "/supplier-write-offs",
    idField: "supplierId",
  },
  employee: {
    adjustment: "/employee-adjustments",
    writeOff: "/employee-write-offs",
    idField: "employeeId",
  },
  expense: {
    adjustment: "/expense-adjustments",
    writeOff: "/expense-write-offs",
    idField: "expenseId",
  },
};

const directionOptions = [
  { value: "incoming", label: "Incoming" },
  { value: "outgoing", label: "Outgoing" },
];

type BalanceAdjustmentFormProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  entityType: AdjustmentEntityType;
  entityId: string;
  mode?: "adjustment" | "write-off";
  defaultDirection?: "incoming" | "outgoing";
};

export function BalanceAdjustmentForm({
  open,
  ...props
}: BalanceAdjustmentFormProps) {
  const isWriteOff = props.mode === "write-off";
  return (
    <Modal
      open={open}
      onClose={props.onClose}
      title={isWriteOff ? "New Write-Off" : "New Balance Adjustment"}
    >
      <BalanceAdjustmentFormBody {...props} />
    </Modal>
  );
}

function BalanceAdjustmentFormBody({
  onClose,
  onSaved,
  entityType,
  entityId,
  mode = "adjustment",
  defaultDirection = "outgoing",
}: Omit<BalanceAdjustmentFormProps, "open">) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const isWriteOff = mode === "write-off";

  const [amount, setAmount] = useState("");
  const [transactionMethod, setTransactionMethod] = useState("cash");
  const [direction, setDirection] = useState<"incoming" | "outgoing">(
    defaultDirection,
  );
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    !!entityId &&
    Number(amount) > 0 &&
    !!description.trim() &&
    !!direction;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const config = ENDPOINT_MAP[entityType];
      const endpoint = isWriteOff ? config.writeOff : config.adjustment;
      const payload: Record<string, unknown> = {
        [config.idField]: entityId,
        amount: round2(Number(amount)),
        direction,
        description: description.trim(),
      };
      if (!isWriteOff) payload.transactionMethod = transactionMethod;

      await api.post(endpoint, payload);
      addAlert(
        "success",
        isWriteOff ? "Write-off created." : "Adjustment created.",
      );
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
      <div
        className={`grid grid-cols-1 ${isWriteOff ? "sm:grid-cols-2" : "sm:grid-cols-3"} gap-3`}
      >
        <FormField label="Amount" required>
          {({ id }) => (
            <MoneyInput
              id={id}
              min="0"
              value={amount}
              onChange={(e) => setAmount(clampNonNegative(e.target.value))}
              required
            />
          )}
        </FormField>
        <FormField label="Direction" required>
          {({ id }) => (
            <SearchableDropdown
              id={id}
              value={direction}
              onChange={(v) => setDirection(v as "incoming" | "outgoing")}
              options={directionOptions}
              placeholder="Select direction…"
              required
            />
          )}
        </FormField>
        {!isWriteOff && (
          <FormField label="Method">
            {({ id }) => (
              <SearchableDropdown
                id={id}
                value={transactionMethod}
                onChange={setTransactionMethod}
                options={transactionMethodOptions}
                placeholder="Select method…"
                defaultFirst
              />
            )}
          </FormField>
        )}
      </div>

      <FormField label="Description" required>
        {({ id }) => (
          <textarea
            id={id}
            className={textareaClass}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        )}
      </FormField>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || !canSubmit}>
          {submitting
            ? "Creating…"
            : isWriteOff
              ? "Create Write-Off"
              : "Create Adjustment"}
        </Button>
      </div>
    </form>
  );
}
