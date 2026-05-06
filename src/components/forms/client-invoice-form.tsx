import { useState, useEffect, useMemo } from "react";
import { Plus, Shuffle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Modal } from "@/components/shared/modal";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { textareaClass } from "@/lib/form-styles";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { cn, getErrorMessage } from "@/lib/utils";
import { invoiceItemTypeOptions } from "@/lib/constants";
import type { Discount, Invoice } from "@/lib/types";
import { ProcedureForm } from "./procedure-form";
import { usePermissions } from "@/hooks/use-permissions";

const VOUCHER_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomVoucherCode(length = 10) {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += VOUCHER_CHARS[Math.floor(Math.random() * VOUCHER_CHARS.length)];
  }
  return out;
}

type GiftMode = "code" | "patient";

type ItemDraft = {
  itemType: "product" | "procedure" | "gift" | "other";
  itemId: string;
  unitPrice: number | null;
  quantity: string;
  amount: string;
  notes: string;
  // gift-only
  giftMode: GiftMode;
  giftCode: string;
  giftPatientId: string;
  giftName: string;
};

const blankItem = (itemType: ItemDraft["itemType"] = "product"): ItemDraft => ({
  itemType,
  itemId: "",
  unitPrice: null,
  quantity: "1",
  amount: "",
  notes: "",
  giftMode: "code",
  giftCode: "",
  giftPatientId: "",
  giftName: "",
});

export function ClientInvoiceForm({
  open,
  onClose,
  onSaved,
  defaultPatientId,
  defaultPatientLabel,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  defaultPatientId?: string;
  defaultPatientLabel?: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title="New Client Invoice">
      <ClientInvoiceFormBody
        open={open}
        defaultPatientId={defaultPatientId}
        defaultPatientLabel={defaultPatientLabel}
        onSubmitted={() => {
          onSaved();
          onClose();
        }}
        onCancel={onClose}
      />
    </Modal>
  );
}

export function ClientInvoiceFormBody({
  open,
  defaultPatientId,
  defaultPatientLabel,
  submitLabel = "Create Invoice",
  cancelLabel = "Cancel",
  onSubmitted,
  onCancel,
}: {
  open: boolean;
  defaultPatientId?: string;
  defaultPatientLabel?: string;
  submitLabel?: string;
  cancelLabel?: string;
  onSubmitted: (invoice: Invoice) => void;
  onCancel: () => void;
}) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const defaultItemType: ItemDraft["itemType"] = can("inventory:read")
    ? "product"
    : can("services:read")
      ? "procedure"
      : "other";
  const visibleItemTypeOptions = invoiceItemTypeOptions.filter((option) => {
    if (option.value === "product") return can("inventory:read");
    if (option.value === "procedure") return can("services:read");
    return true;
  });

  const [patientId, setPatientId] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [discountId, setDiscountId] = useState("");
  const [discountValue, setDiscountValue] = useState(0);
  const [discountValueType, setDiscountValueType] = useState<
    "percentage" | "fixed" | ""
  >("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([blankItem(defaultItemType)]);
  const [offerOptions, setOfferOptions] = useState<
    {
      value: string;
      label: string;
      meta: { value: number; valueType: "percentage" | "fixed" };
    }[]
  >([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPatientId(defaultPatientId ?? "");
    setCurrencyId("");
    setDiscountId("");
    setDiscountValue(0);
    setDiscountValueType("");
    setNotes("");
    setItems([blankItem(defaultItemType)]);
  }, [open, defaultItemType, defaultPatientId]);

  useEffect(() => {
    if (!open) return;
    api
      .get<{ items: Discount[] } | Discount[]>("/discounts?limit=100")
      .then((res) => {
        const list = Array.isArray(res) ? res : (res.items ?? []);
        const offers = list
          .filter((d) => d.discountType === "offer" && !!d.isActive)
          .map((d) => ({
            value: d.id,
            label: `${d.name} (${
              d.valueType === "percentage"
                ? `${d.value}%`
                : `$${d.value.toFixed(2)}`
            })`,
            meta: { value: d.value, valueType: d.valueType },
          }));
        setOfferOptions(offers);
      })
      .catch(() => setOfferOptions([]));
  }, [open]);

  const updateItem = (idx: number, patch: Partial<ItemDraft>) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const updated = { ...it, ...patch };
        const recalcTriggers = "quantity" in patch || "unitPrice" in patch;
        if (
          recalcTriggers &&
          updated.unitPrice != null &&
          updated.itemType !== "gift"
        ) {
          const qty =
            updated.itemType === "procedure"
              ? 1
              : Number(updated.quantity) || 0;
          updated.amount = `${updated.unitPrice * qty}`;
        }
        return updated;
      }),
    );
  };

  const handleItemSelected = async (idx: number, itemId: string) => {
    updateItem(idx, { itemId, unitPrice: null, amount: "" });
    const type = items[idx].itemType;
    if (!itemId || type === "other" || type === "gift") return;
    try {
      const endpoint =
        type === "product" ? `/products/${itemId}` : `/procedures/${itemId}`;
      const res = await api.get<{ unitPrice?: number; price?: number }>(
        endpoint,
      );
      const price = type === "product" ? res.unitPrice : res.price;
      if (price != null) updateItem(idx, { unitPrice: price });
    } catch {
      // silent: user can still enter amount manually
    }
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const grossTotal = useMemo(
    () => items.reduce((s, it) => s + (Number(it.amount) || 0), 0),
    [items],
  );

  const computedDiscount = useMemo(() => {
    if (!discountId || !discountValueType) return 0;
    const raw =
      discountValueType === "percentage"
        ? grossTotal * (discountValue / 100)
        : discountValue;
    return Math.min(Math.max(0, raw), grossTotal);
  }, [discountId, discountValueType, discountValue, grossTotal]);

  const finalTotal = Math.max(0, grossTotal - computedDiscount);

  const canSubmit =
    patientId &&
    currencyId &&
    items.length > 0 &&
    items.every((it) => {
      if (it.itemType === "gift") {
        if (Number(it.amount) <= 0) return false;
        if (it.giftMode === "code") return it.giftCode.trim().length > 0;
        return it.giftPatientId.length > 0;
      }
      if (it.itemType === "other") {
        return Number(it.amount) > 0;
      }
      return (
        it.itemId &&
        (it.itemType === "procedure" || Number(it.quantity) > 0) &&
        Number(it.amount) > 0
      );
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const created = await api.post<Invoice>("/client-invoices", {
        patientId,
        currencyId,
        ...(discountId ? { discountId } : {}),
        notes: notes || undefined,
        items: items.map((it) => {
          if (it.itemType === "gift") {
            return {
              itemType: "gift",
              amount: Number(it.amount),
              ...(it.notes ? { notes: it.notes } : {}),
              ...(it.giftMode === "code"
                ? { giftCode: it.giftCode.trim() }
                : { giftPatientId: it.giftPatientId }),
            };
          }
          if (it.itemType === "other") {
            return {
              itemType: "other",
              amount: Number(it.amount),
              ...(it.notes ? { notes: it.notes } : {}),
            };
          }
          return {
            itemType: it.itemType,
            itemId: it.itemId,
            quantity: it.itemType === "procedure" ? 1 : Number(it.quantity),
            amount: Number(it.amount),
            ...(it.notes ? { notes: it.notes } : {}),
          };
        }),
      });
      addAlert("success", "Client invoice created.");
      onSubmitted(created);
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Patient</label>
          <SearchableDropdown
            value={patientId}
            onChange={setPatientId}
            defaultApiOption={
              defaultPatientId && defaultPatientLabel
                ? { value: defaultPatientId, label: defaultPatientLabel }
                : undefined
            }
            apiEndpoint="/patients/dropdown"
            mapItem={(p: { id: string; name: string }) => ({
              value: p.id,
              label: p.name,
            })}
            placeholder="Select patient…"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Currency</label>
          <SearchableDropdown
            value={currencyId}
            onChange={setCurrencyId}
            apiEndpoint="/currencies/dropdown"
            mapItem={(c: { id: string; name: string }) => ({
              value: c.id,
              label: c.name,
            })}
            placeholder="Select currency…"
            required
            defaultFirst
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium">Notes</label>
        <textarea
          className={textareaClass}
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* Items */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Items</label>
          <Button
            type="button"
            size="sm"
            onClick={() => setItems((prev) => [...prev, blankItem()])}
          >
            <Plus className="size-3.5 mr-1" /> Add Item
          </Button>
        </div>

        {items.map((item, idx) => {
          const isGift = item.itemType === "gift";
          const isOther = item.itemType === "other";
          const itemLabel =
            item.itemType === "product"
              ? "Product"
              : item.itemType === "procedure"
                ? "Procedure"
                : "Gift Name";
          return (
            <div
              key={idx}
              className="rounded-lg border border-border p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Item #{idx + 1}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeItem(idx)}
                  disabled={items.length === 1}
                  aria-label="Remove item"
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>

              <div
                className={cn(
                  "grid gap-3",
                  isOther ? "grid-cols-[160px_1fr]" : "grid-cols-[160px_1fr]",
                )}
              >
                <div className="space-y-1.5 min-w-0">
                  <label className="text-sm font-medium">Type</label>
                  <SearchableDropdown
                    value={item.itemType}
                    onChange={(v) =>
                      updateItem(idx, {
                        ...blankItem(v as ItemDraft["itemType"]),
                      })
                    }
                    options={visibleItemTypeOptions}
                    placeholder="Type…"
                  />
                </div>
                {!isOther && (
                  <div className="space-y-1.5 min-w-0">
                    <label className="text-sm font-medium">{itemLabel} *</label>
                    {item.itemType === "product" ? (
                      <SearchableDropdown
                        value={item.itemId}
                        onChange={(v) => handleItemSelected(idx, v)}
                        apiEndpoint="/products/dropdown"
                        mapItem={(p: { id: string; name: string }) => ({
                          value: p.id,
                          label: p.name,
                        })}
                        placeholder="Select product…"
                      />
                    ) : item.itemType === "procedure" ? (
                      <SearchableDropdown
                        value={item.itemId}
                        onChange={(v) => handleItemSelected(idx, v)}
                        apiEndpoint="/procedures/dropdown"
                        mapItem={(p: { id: string; name: string }) => ({
                          value: p.id,
                          label: p.name,
                        })}
                        placeholder="Select procedure…"
                        renderAddForm={
                          can("services:write")
                            ? ({ open, onClose, onCreated }) => (
                                <ProcedureForm
                                  open={open}
                                  onClose={onClose}
                                  onSaved={(created) => {
                                    if (created)
                                      onCreated(
                                        String(created.id),
                                        String(created.name),
                                      );
                                  }}
                                />
                              )
                            : undefined
                        }
                      />
                    ) : (
                      <Input
                        placeholder="e.g. Holiday Gift"
                        value={item.giftName}
                        onChange={(e) =>
                          updateItem(idx, { giftName: e.target.value })
                        }
                      />
                    )}
                  </div>
                )}
              </div>

              {isGift && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Gift Type *</label>
                    <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() =>
                          updateItem(idx, {
                            giftMode: "code",
                            giftPatientId: "",
                          })
                        }
                        className={cn(
                          "rounded px-3 py-1 transition-colors",
                          item.giftMode === "code"
                            ? "bg-accent font-medium"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        Sell with code
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateItem(idx, {
                            giftMode: "patient",
                            giftCode: "",
                          })
                        }
                        className={cn(
                          "rounded px-3 py-1 transition-colors",
                          item.giftMode === "patient"
                            ? "bg-accent font-medium"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        Send to patient
                      </button>
                    </div>
                  </div>
                  {item.giftMode === "code" ? (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Code *</label>
                      <div className="flex gap-2">
                        <Input
                          value={item.giftCode}
                          onChange={(e) =>
                            updateItem(idx, {
                              giftCode: e.target.value.toUpperCase(),
                            })
                          }
                          placeholder="GIFT-XXXX"
                          className="flex-1 font-mono"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          title="Generate random code"
                          onClick={() =>
                            updateItem(idx, { giftCode: randomVoucherCode() })
                          }
                        >
                          <Shuffle className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Recipient *</label>
                      <SearchableDropdown
                        value={item.giftPatientId}
                        onChange={(v) => updateItem(idx, { giftPatientId: v })}
                        apiEndpoint="/patients/dropdown"
                        mapItem={(p: { id: string; name: string }) => ({
                          value: p.id,
                          label: p.name,
                        })}
                        placeholder="Select recipient patient…"
                      />
                    </div>
                  )}
                </>
              )}

              <div
                className={cn(
                  "grid gap-3",
                  isGift || item.itemType === "procedure" || isOther
                    ? "grid-cols-[1fr_1.5fr]"
                    : "grid-cols-[90px_1fr_1.5fr]",
                )}
              >
                {!isGift && !isOther && item.itemType !== "procedure" && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Qty *</label>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(idx, { quantity: e.target.value })
                      }
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    {isGift ? "Value *" : "Amount *"}
                  </label>
                  <InputGroup>
                    <InputGroupAddon>$</InputGroupAddon>
                    <InputGroupInput
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={item.amount}
                      readOnly={
                        !isGift &&
                        !isOther &&
                        item.unitPrice != null &&
                        (item.itemType === "product" ||
                          item.itemType === "procedure")
                      }
                      onChange={(e) =>
                        updateItem(idx, { amount: e.target.value })
                      }
                    />
                  </InputGroup>
                  {item.itemType === "product" && item.unitPrice != null && (
                    <p className="text-xs text-muted-foreground">
                      Unit: ${item.unitPrice.toFixed(2)}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Notes</label>
                  <Input
                    placeholder="Optional"
                    value={item.notes}
                    onChange={(e) => updateItem(idx, { notes: e.target.value })}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Invoice-level discount */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Invoice Discount</label>
        <SearchableDropdown
          value={discountId}
          onChange={(v) => {
            setDiscountId(v);
            if (v === "") {
              setDiscountValue(0);
              setDiscountValueType("");
            }
          }}
          onSelectItem={(opt) => {
            setDiscountId(opt.value);
            setDiscountValue((opt.meta?.value as number) ?? 0);
            setDiscountValueType(
              (opt.meta?.valueType as "percentage" | "fixed") ?? "",
            );
          }}
          options={offerOptions}
          placeholder="No discount"
          clearable
        />
      </div>

      {/* Totals + Actions */}
      <div className="flex items-end justify-between pt-2">
        <div className="text-sm space-y-0.5">
          {computedDiscount > 0 && (
            <>
              <div className="flex gap-3">
                <span className="text-muted-foreground">Subtotal:</span>
                <span>${grossTotal.toFixed(2)}</span>
              </div>
              <div className="flex gap-3">
                <span className="text-muted-foreground">Discount:</span>
                <span>-${computedDiscount.toFixed(2)}</span>
              </div>
            </>
          )}
          <div className="font-medium">Total: ${finalTotal.toFixed(2)}</div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="submit" disabled={submitting || !canSubmit}>
            {submitting ? "Creating…" : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
