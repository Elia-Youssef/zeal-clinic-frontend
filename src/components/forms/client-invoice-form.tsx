import { useCallback, useState, useEffect, useMemo } from "react";
import { Plus, Shuffle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { MoneyInput } from "@/components/shared/money-input";
import { SearchableDropdown } from "@/components/shared/searchable-dropdown";
import { FormDraftsLayout } from "@/components/shared/form-drafts";
import { textareaClass } from "@/lib/form-styles";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { cn, getErrorMessage, clampNonNegative } from "@/lib/utils";
import { invoiceItemTypeOptions } from "@/lib/constants";
import type { Discount, Invoice } from "@/lib/types";
import { ProcedureForm } from "./procedure-form";
import { PatientForm } from "./patient-form";
import { ProductForm } from "./product-form";
import { DiscountForm } from "./discount-form";
import { usePermissions } from "@/hooks/use-permissions";
import { useFormDrafts, type DraftMode } from "@/hooks/use-form-drafts";

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
  itemLabel: string;
  unitPrice: number | null;
  quantity: string;
  amount: string;
  notes: string;
  giftMode: GiftMode;
  giftCode: string;
  giftPatientId: string;
  giftName: string;
};

const blankItem = (itemType: ItemDraft["itemType"] = "product"): ItemDraft => ({
  itemType,
  itemId: "",
  itemLabel: "",
  unitPrice: null,
  quantity: "1",
  amount: "",
  notes: "",
  giftMode: "code",
  giftCode: "",
  giftPatientId: "",
  giftName: "",
});

// Serializable snapshot of the form, persisted as a draft.
type InvoiceDraftData = {
  invoiceNumber: string;
  invoiceNumberAuto: boolean;
  patientId: string;
  patientName: string;
  discountId: string;
  discountValue: number;
  discountValueType: "percentage" | "fixed" | "";
  notes: string;
  items: ItemDraft[];
};

export function ClientInvoiceForm({
  open,
  onClose,
  onSaved,
  defaultPatientId,
  defaultPatientLabel,
  defaultProcedures,
  draftGroup = "client-invoice",
  draftMode = "auto",
  draftId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  defaultPatientId?: string;
  defaultPatientLabel?: string;
  /** Pre-fill the items list with these procedures (e.g. from an appointment). */
  defaultProcedures?: { id: string; label?: string }[];
  /** Drafts namespace; pass `undefined` to disable the drafts panel. */
  draftGroup?: string;
  draftMode?: DraftMode;
  /** Auto-load this draft on open if it exists (e.g. an appointment id). */
  draftId?: string;
}) {
  const draftsEnabled = !!draftGroup && draftMode !== "off";
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Client Invoice"
      size={draftsEnabled ? "wide" : "default"}
    >
      <ClientInvoiceFormBody
        open={open}
        defaultPatientId={defaultPatientId}
        defaultPatientLabel={defaultPatientLabel}
        defaultProcedures={defaultProcedures}
        draftGroup={draftGroup}
        draftMode={draftMode}
        draftId={draftId}
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
  defaultProcedures,
  submitLabel = "Create Invoice",
  cancelLabel = "Cancel",
  draftGroup,
  draftMode = "off",
  draftId,
  onSubmitted,
  onCancel,
}: {
  open: boolean;
  defaultPatientId?: string;
  defaultPatientLabel?: string;
  /** Pre-fill items with these procedures (e.g. from an appointment). */
  defaultProcedures?: { id: string; label?: string }[];
  submitLabel?: string;
  cancelLabel?: string;
  draftGroup?: string;
  draftMode?: DraftMode;
  draftId?: string;
  onSubmitted: (invoice: Invoice) => void;
  onCancel: () => void;
}) {
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const defaultItemType: ItemDraft["itemType"] = can("products:read")
    ? "product"
    : can("procedures:read")
      ? "procedure"
      : "other";
  const visibleItemTypeOptions = invoiceItemTypeOptions.filter((option) => {
    if (option.value === "product") return can("products:read");
    if (option.value === "procedure") return can("procedures:read");
    return true;
  });

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceNumberAuto, setInvoiceNumberAuto] = useState(true);
  const [patientId, setPatientId] = useState("");
  // Tracked alongside patientId so a draft can show the patient name as its title.
  const [patientName, setPatientName] = useState(defaultPatientLabel ?? "");
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

  const makeBlank = useCallback(
    (): InvoiceDraftData => ({
      invoiceNumber: "",
      invoiceNumberAuto: true,
      patientId: defaultPatientId ?? "",
      patientName: defaultPatientLabel ?? "",
      discountId: "",
      discountValue: 0,
      discountValueType: "",
      notes: "",
      items:
        defaultProcedures && defaultProcedures.length > 0
          ? defaultProcedures.map((p) => ({
              ...blankItem("procedure"),
              itemId: p.id,
              itemLabel: p.label ?? "",
            }))
          : [blankItem(defaultItemType)],
    }),
    [defaultItemType, defaultPatientId, defaultPatientLabel, defaultProcedures],
  );

  const applySnapshot = useCallback(
    (d: InvoiceDraftData) => {
      setInvoiceNumber(d.invoiceNumber);
      setInvoiceNumberAuto(d.invoiceNumberAuto);
      setPatientId(d.patientId);
      setPatientName(d.patientName);
      setDiscountId(d.discountId);
      setDiscountValue(d.discountValue);
      setDiscountValueType(d.discountValueType);
      setNotes(d.notes);
      setItems(d.items.length ? d.items : [blankItem(defaultItemType)]);
    },
    [defaultItemType],
  );

  // Reset to blank on open; the drafts hook may then auto-load a draft (below).
  useEffect(() => {
    if (!open) return;
    applySnapshot(makeBlank());
  }, [open, applySnapshot, makeBlank]);

  const snapshot = useMemo<InvoiceDraftData>(
    () => ({
      invoiceNumber,
      invoiceNumberAuto,
      patientId,
      patientName,
      discountId,
      discountValue,
      discountValueType,
      notes,
      items,
    }),
    [
      invoiceNumber,
      invoiceNumberAuto,
      patientId,
      patientName,
      discountId,
      discountValue,
      discountValueType,
      notes,
      items,
    ],
  );

  const drafts = useFormDrafts<InvoiceDraftData>({
    group: draftGroup,
    mode: draftMode,
    open,
    snapshot,
    apply: applySnapshot,
    blank: () => applySnapshot(makeBlank()),
    initialId: draftId,
    // Patient can be pre-filled on open (defaultPatientId), so a draft only counts as having
    // content once there are real line items / notes / discount / number.
    isEmpty: (d) => {
      const first = d.items[0];
      const noItems =
        d.items.length <= 1 &&
        (!first ||
          (!first.itemId &&
            !first.amount &&
            !first.giftName &&
            !first.giftCode &&
            !first.giftPatientId));
      return noItems && !d.notes && !d.discountId && !d.invoiceNumber;
    },
    label: (d) => d.patientName.trim() || "No patient yet",
  });

  // Autofill prices for procedures seeded from `defaultProcedures`.
  useEffect(() => {
    if (!open || !defaultProcedures?.length) return;
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        defaultProcedures.map((p) =>
          api
            .get<{ price?: number }>(`/procedures/${p.id}`)
            .then((res) => ({ id: p.id, price: res.price ?? null }))
            .catch(() => ({ id: p.id, price: null as number | null })),
        ),
      );
      if (cancelled) return;
      const priceById = new Map(results.map((r) => [r.id, r.price]));
      setItems((prev) =>
        prev.map((it) => {
          if (it.itemType !== "procedure") return it;
          const price = priceById.get(it.itemId);
          if (price == null) return it;
          return { ...it, unitPrice: price, amount: `${price}` };
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [open, defaultProcedures]);

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
          updated.unitPrice > 0 &&
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

  const handleItemSelected = async (
    idx: number,
    itemId: string,
    itemLabel = "",
  ) => {
    updateItem(idx, { itemId, itemLabel, unitPrice: null, amount: "" });
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
      // Manual amount entry still works.
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
    (invoiceNumberAuto || Number(invoiceNumber) > 0) &&
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
        ...(invoiceNumberAuto ? {} : { invoiceNumber: Number(invoiceNumber) }),
        patientId,
        ...(discountId ? { discountId } : {}),
        notes: notes || undefined,
        items: items.map((it) => {
          if (it.itemType === "gift") {
            return {
              itemType: "gift",
              amount: Number(it.amount),
              giftName: it.giftName,
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
      drafts.discardActive();
      onSubmitted(created);
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const patientDropdownOption =
    patientId && patientName
      ? { value: patientId, label: patientName }
      : defaultPatientId && defaultPatientLabel
        ? { value: defaultPatientId, label: defaultPatientLabel }
        : undefined;

  const formEl = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="clientInvoiceNumber" className="text-sm font-medium">
            Invoice Number *
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              id="clientInvoiceNumberAuto"
              checked={invoiceNumberAuto}
              onCheckedChange={(value) => {
                const next = Boolean(value);
                setInvoiceNumberAuto(next);
                if (next) setInvoiceNumber("");
              }}
            />
            <span>Auto</span>
          </label>
        </div>
        <Input
          id="clientInvoiceNumber"
          type="number"
          min="1"
          step="1"
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(clampNonNegative(e.target.value))}
          disabled={invoiceNumberAuto}
          placeholder={invoiceNumberAuto ? "Auto-generated" : ""}
        />
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Patient</label>
          <SearchableDropdown
            value={patientId}
            onChange={(v) => {
              setPatientId(v);
              if (!v) setPatientName("");
            }}
            onSelectItem={(opt) => {
              setPatientId(opt.value);
              setPatientName(opt.label);
            }}
            defaultApiOption={patientDropdownOption}
            apiEndpoint="/patients/dropdown"
            mapItem={(p: { id: string; name: string }) => ({
              value: p.id,
              label: p.name,
            })}
            placeholder="Select patient…"
            required
            renderAddForm={
              can("patients:write")
                ? ({ open: addOpen, onClose: closeAdd, onCreated }) => (
                    <PatientForm
                      open={addOpen}
                      onClose={closeAdd}
                      onSaved={(created) => {
                        if (created) {
                          const name = `${created.firstName ?? ""} ${
                            created.lastName ?? ""
                          }`.trim();
                          setPatientName(name);
                          onCreated(String(created.id), name);
                        }
                      }}
                    />
                  )
                : undefined
            }
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
                  isOther
                    ? "grid-cols-1 sm:grid-cols-[160px_1fr]"
                    : "grid-cols-1 sm:grid-cols-[160px_1fr]",
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
                        onChange={(v) => {
                          if (!v) handleItemSelected(idx, "");
                        }}
                        onSelectItem={(opt) =>
                          handleItemSelected(idx, opt.value, opt.label)
                        }
                        defaultApiOption={
                          item.itemId && item.itemLabel
                            ? { value: item.itemId, label: item.itemLabel }
                            : undefined
                        }
                        apiEndpoint="/products/dropdown"
                        mapItem={(p: { id: string; name: string }) => ({
                          value: p.id,
                          label: p.name,
                        })}
                        placeholder="Select product…"
                        renderAddForm={
                          can("products:write")
                            ? ({ open, onClose, onCreated }) => (
                                <ProductForm
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
                    ) : item.itemType === "procedure" ? (
                      <SearchableDropdown
                        value={item.itemId}
                        onChange={(v) => {
                          if (!v) handleItemSelected(idx, "");
                        }}
                        onSelectItem={(opt) =>
                          handleItemSelected(idx, opt.value, opt.label)
                        }
                        defaultApiOption={
                          item.itemId && item.itemLabel
                            ? { value: item.itemId, label: item.itemLabel }
                            : undefined
                        }
                        apiEndpoint="/procedures/dropdown"
                        mapItem={(p: { id: string; name: string }) => ({
                          value: p.id,
                          label: p.name,
                        })}
                        placeholder="Select procedure…"
                        renderAddForm={
                          can("procedures:write")
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
                    <div className="flex w-fit rounded-lg border border-border p-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          updateItem(idx, {
                            giftMode: "code",
                            giftPatientId: "",
                          })
                        }
                        className={cn(
                          "rounded-md px-3 py-1 transition-colors",
                          item.giftMode === "code"
                            ? "bg-accent font-medium"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        Code
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
                          "rounded-md px-3 py-1 transition-colors",
                          item.giftMode === "patient"
                            ? "bg-accent font-medium"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        Apply to recipient
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
                        renderAddForm={
                          can("patients:write")
                            ? ({ open, onClose, onCreated }) => (
                                <PatientForm
                                  open={open}
                                  onClose={onClose}
                                  onSaved={(created) => {
                                    if (created) {
                                      onCreated(
                                        String(created.id),
                                        `${created.firstName ?? ""} ${
                                          created.lastName ?? ""
                                        }`.trim(),
                                      );
                                    }
                                  }}
                                />
                              )
                            : undefined
                        }
                      />
                    </div>
                  )}
                </>
              )}

              <div
                className={cn(
                  "grid gap-3",
                  isGift || item.itemType === "procedure" || isOther
                    ? "grid-cols-1 sm:grid-cols-[1fr_1.5fr]"
                    : "grid-cols-1 sm:grid-cols-[90px_1fr_1.5fr]",
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
                        updateItem(idx, {
                          quantity: clampNonNegative(e.target.value),
                        })
                      }
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    {isGift ? "Value *" : "Amount *"}
                  </label>
                  <MoneyInput
                    min="0"
                    value={item.amount}
                    readOnly={
                      !isGift &&
                      !isOther &&
                      item.unitPrice != null &&
                      item.unitPrice > 0 &&
                      (item.itemType === "product" ||
                        item.itemType === "procedure")
                    }
                    onChange={(e) =>
                      updateItem(idx, {
                        amount: clampNonNegative(e.target.value),
                      })
                    }
                  />
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
          renderAddForm={
            can("discounts:write")
              ? ({ open: addOpen, onClose: closeAdd, onCreated }) => (
                  <DiscountForm
                    open={addOpen}
                    onClose={closeAdd}
                    onSaved={(created) => {
                      if (!created) return;
                      const value = Number(created.value) || 0;
                      const valueType: "percentage" | "fixed" =
                        created.valueType === "fixed" ? "fixed" : "percentage";
                      const label = `${created.name} (${
                        valueType === "percentage"
                          ? `${value}%`
                          : `$${value.toFixed(2)}`
                      })`;
                      const option = {
                        value: String(created.id),
                        label,
                        meta: { value, valueType },
                      };
                      setOfferOptions((prev) => [option, ...prev]);
                      setDiscountValue(value);
                      setDiscountValueType(valueType);
                      onCreated(option.value, option.label);
                    }}
                  />
                )
              : undefined
          }
        />
      </div>

      <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-end sm:justify-between">
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
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
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

  return <FormDraftsLayout drafts={drafts}>{formEl}</FormDraftsLayout>;
}
