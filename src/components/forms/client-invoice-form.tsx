
import { useState, useEffect } from "react";
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
import type { Invoice } from "@/lib/types";
import { ProcedureForm } from "./procedure-form";
import { usePermissions } from "@/hooks/use-permissions";

type DiscountSource = "discount" | "voucher";
type AppliedValueType = "percentage" | "fixed" | "";

const VOUCHER_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomVoucherCode(length = 10) {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += VOUCHER_CHARS[Math.floor(Math.random() * VOUCHER_CHARS.length)];
  }
  return out;
}

type ItemDraft = {
  itemType: "product" | "procedure" | "discount" | "other";
  itemId: string;
  unitPrice: number | null;
  quantity: string;
  discountedAmount: number;
  amount: string;
  notes: string;
  discountSource: DiscountSource;
  discountId: string;
  voucherId: string;
  appliedValue: number;
  appliedValueType: AppliedValueType;
  giftName: string;
  giftDescription: string;
  voucherCode: string;
};

const blankItem = (itemType: ItemDraft["itemType"] = "product"): ItemDraft => ({
  itemType,
  itemId: "",
  unitPrice: null,
  quantity: "1",
  discountedAmount: 0,
  amount: "",
  notes: "",
  discountSource: "discount",
  discountId: "",
  voucherId: "",
  appliedValue: 0,
  appliedValueType: "",
  giftName: "",
  giftDescription: "",
  voucherCode: "",
});

const applyDiscount = (
  gross: number,
  value: number,
  valueType: AppliedValueType,
) => {
  if (!valueType) return gross;
  if (valueType === "percentage") {
    return Math.max(0, gross - gross * (value / 100));
  }
  return Math.max(0, gross - value);
};

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
    if (option.value === "procedure" || option.value === "discount") {
      return can("services:read");
    }
    return true;
  });

  const [patientId, setPatientId] = useState("");
  const [currencyId, setCurrencyId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([
    blankItem(defaultItemType),
  ]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPatientId(defaultPatientId ?? "");
    setCurrencyId("");
    setNotes("");
    setItems([blankItem(defaultItemType)]);
  }, [open, defaultItemType]);

  const updateItem = (idx: number, patch: Partial<ItemDraft>) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const updated = { ...it, ...patch };
        const recalcTriggers =
          "quantity" in patch ||
          "unitPrice" in patch ||
          "appliedValue" in patch ||
          "appliedValueType" in patch ||
          "discountSource" in patch;
        if (recalcTriggers && updated.unitPrice != null) {
          const qty =
            updated.itemType === "procedure"
              ? 1
              : Number(updated.quantity) || 0;
          const gross = updated.unitPrice * qty;
          updated.amount = `${gross}`;
          updated.discountedAmount = applyDiscount(
            gross,
            updated.appliedValue,
            updated.appliedValueType,
          );
        }
        return updated;
      }),
    );
  };

  const handleItemSelected = async (idx: number, itemId: string) => {
    updateItem(idx, {
      itemId,
      unitPrice: null,
      amount: "",
      discountId: "",
      voucherId: "",
      appliedValue: 0,
      appliedValueType: "",
    });
    const type = items[idx].itemType;
    if (!itemId || type === "other") return;
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

  const total = items.reduce((s, it) => {
    const v =
      it.itemType === "discount"
        ? Number(it.amount)
        : Number(it.discountedAmount);
    return s + (v || 0);
  }, 0);

  const canSubmit =
    patientId &&
    currencyId &&
    items.length > 0 &&
    items.every((it) => {
      if (it.itemType === "discount") {
        return (
          it.giftName.trim().length > 0 &&
          Number(it.amount) > 0 &&
          it.voucherCode.trim().length > 0
        );
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
        notes: notes || undefined,
        items: items.map((it) => {
          if (it.itemType === "discount") {
            return {
              itemType: "discount",
              quantity: 1,
              amount: Number(it.amount),
              ...(it.notes ? { notes: it.notes } : {}),
              discountName: it.giftName.trim(),
              ...(it.giftDescription
                ? { discountDescription: it.giftDescription }
                : {}),
              voucherCode: it.voucherCode.trim(),
            };
          }
          return {
            itemType: it.itemType,
            itemId: it.itemId,
            quantity: it.itemType === "procedure" ? 1 : Number(it.quantity),
            amount: Number(it.amount),
            ...(it.notes ? { notes: it.notes } : {}),
            ...(it.discountSource === "voucher" && it.voucherId
              ? { voucherId: it.voucherId }
              : it.discountSource === "discount" && it.discountId
                ? { discountId: it.discountId }
                : {}),
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

        {/* Notes */}
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
            const isGift = item.itemType === "discount";
            const itemLabel =
              item.itemType === "product"
                ? "Product"
                : item.itemType === "procedure"
                  ? "Procedure"
                  : isGift
                    ? "Gift Name"
                    : "Description";
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

                <div className="grid grid-cols-[160px_1fr] gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Type</label>
                    <SearchableDropdown
                      value={item.itemType}
                      onChange={(v) =>
                        updateItem(idx, {
                          itemType: v as ItemDraft["itemType"],
                          itemId: "",
                          unitPrice: null,
                          amount: "",
                          discountedAmount: 0,
                          quantity: "1",
                          discountId: "",
                          voucherId: "",
                          appliedValue: 0,
                          appliedValueType: "",
                          giftName: "",
                          giftDescription: "",
                          voucherCode: "",
                        })
                      }
                      options={visibleItemTypeOptions}
                      placeholder="Type…"
                    />
                  </div>
                  <div className="space-y-1.5">
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
                    ) : isGift ? (
                      <Input
                        placeholder="e.g. Holiday Gift"
                        value={item.giftName}
                        onChange={(e) =>
                          updateItem(idx, { giftName: e.target.value })
                        }
                      />
                    ) : (
                      <Input
                        placeholder="Description"
                        value={item.itemId}
                        onChange={(e) =>
                          updateItem(idx, { itemId: e.target.value })
                        }
                      />
                    )}
                  </div>
                </div>

                {isGift && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Description</label>
                      <textarea
                        className={textareaClass}
                        rows={2}
                        placeholder="Optional"
                        value={item.giftDescription}
                        onChange={(e) =>
                          updateItem(idx, { giftDescription: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">
                        Voucher Code *
                      </label>
                      <div className="flex gap-2">
                        <Input
                          value={item.voucherCode}
                          onChange={(e) =>
                            updateItem(idx, {
                              voucherCode: e.target.value.toUpperCase(),
                            })
                          }
                          placeholder="GIFT2026"
                          className="flex-1 font-mono"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          title="Generate random code"
                          onClick={() =>
                            updateItem(idx, { voucherCode: randomVoucherCode() })
                          }
                        >
                          <Shuffle className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                <div
                  className={cn(
                    "grid gap-3",
                    isGift || item.itemType === "procedure"
                      ? "grid-cols-[1fr_1.5fr]"
                      : "grid-cols-[90px_1fr_1.5fr]",
                  )}
                >
                  {!isGift && item.itemType !== "procedure" && (
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
                        value={isGift ? item.amount : item.discountedAmount}
                        readOnly={!isGift && item.unitPrice != null}
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
                      onChange={(e) =>
                        updateItem(idx, { notes: e.target.value })
                      }
                    />
                  </div>
                </div>

                {!isGift && (() => {
                  const isSelectableItem =
                    !!item.itemId &&
                    (item.itemType === "product" ||
                      item.itemType === "procedure");
                  return (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium">Discount</label>
                        <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
                          <button
                            type="button"
                            onClick={() =>
                              updateItem(idx, {
                                discountSource: "discount",
                                voucherId: "",
                                appliedValue: 0,
                                appliedValueType: "",
                              })
                            }
                            className={cn(
                              "rounded px-2 py-0.5 transition-colors",
                              item.discountSource === "discount"
                                ? "bg-accent font-medium"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            Offer
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateItem(idx, {
                                discountSource: "voucher",
                                discountId: "",
                                appliedValue: 0,
                                appliedValueType: "",
                              })
                            }
                            className={cn(
                              "rounded px-2 py-0.5 transition-colors",
                              item.discountSource === "voucher"
                                ? "bg-accent font-medium"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            Voucher
                          </button>
                        </div>
                      </div>
                      {item.discountSource === "discount" ? (
                        <SearchableDropdown
                          value={item.discountId}
                          onChange={(v) =>
                            updateItem(idx, {
                              discountId: v,
                              ...(v === ""
                                ? { appliedValue: 0, appliedValueType: "" }
                                : {}),
                            })
                          }
                          onSelectItem={(opt) =>
                            updateItem(idx, {
                              discountId: opt.value,
                              appliedValue: (opt.meta?.value as number) ?? 0,
                              appliedValueType:
                                (opt.meta?.valueType as AppliedValueType) ??
                                "",
                            })
                          }
                          apiEndpoint={
                            isSelectableItem
                              ? `/items/${item.itemId}/discounts`
                              : undefined
                          }
                          mapItem={(d: {
                            id: string;
                            name: string;
                            value: number;
                            valueType: "percentage" | "fixed";
                          }) => ({
                            value: d.id,
                            label: `${d.name} (${
                              d.valueType === "percentage"
                                ? `${d.value}%`
                                : `$${d.value.toFixed(2)}`
                            })`,
                            meta: { value: d.value, valueType: d.valueType },
                          })}
                          options={isSelectableItem ? undefined : []}
                          placeholder="Select an offer"
                          disabled={!isSelectableItem}
                          clearable
                        />
                      ) : (
                        <SearchableDropdown
                          value={item.voucherId}
                          onChange={(v) => updateItem(idx, { voucherId: v })}
                          apiEndpoint={
                            isSelectableItem
                              ? `/items/${item.itemId}/vouchers`
                              : undefined
                          }
                          mapItem={(v: {
                            id: string;
                            code: string;
                            discountId: string;
                            isUsed: number;
                          }) => ({
                            value: v.id,
                            label: v.isUsed ? `${v.code} (used)` : v.code,
                          })}
                          options={isSelectableItem ? undefined : []}
                          placeholder="Select a voucher"
                          disabled={!isSelectableItem}
                          clearable
                        />
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>

        {/* Total + Actions */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm font-medium">
            Total: ${total.toFixed(2)}
          </span>
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
