import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Printer, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { FormField } from "@/components/shared/form-field";
import { MoneyInput } from "@/components/shared/money-input";
import { PageHeader } from "@/components/shared/page-header";
import { DetailField } from "@/components/shared/detail-field";
import { MultilineText } from "@/components/shared/multiline-text";
import { Loading } from "@/components/shared/loading";
import { DataTable } from "@/components/data/data-table";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage, clampNonNegative, round2 } from "@/lib/utils";
import { beirutDayKey } from "@/lib/tz";
import { usePageTitle } from "@/hooks/use-page-title";
import { usePermissions } from "@/hooks/use-permissions";
import { useConfirm } from "@/hooks/use-confirm";
import { useAdjustOnChange } from "@/hooks/use-adjust-on-change";
import { useApiQuery } from "@/hooks/use-api-query";
import type { Invoice, InvoiceItem } from "@/lib/types";

export default function InvoiceDetailPage() {
  usePageTitle("Invoice");
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const confirm = useConfirm();

  const {
    data: invoice,
    loading,
    reload,
  } = useApiQuery(
    () => api.get<Invoice>(`/invoices/${id}`),
    [id],
    () => addAlert("error", "Failed to load invoice."),
  );

  const [editOpen, setEditOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const [editItem, setEditItem] = useState<InvoiceItem | null>(null);
  const [itemAmount, setItemAmount] = useState("");
  const [itemSubmitting, setItemSubmitting] = useState(false);

  // A loaded invoice seeds the notes box.
  useAdjustOnChange([invoice], () => setNotes(invoice?.notes ?? ""));

  const handlePrintPdf = async () => {
    setPdfLoading(true);
    try {
      await api.openPdf(`/invoices/${id}/pdf`);
    } catch (err) {
      addAlert("error", getErrorMessage(err, "Failed to generate PDF."));
    } finally {
      setPdfLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!invoice) return;
    const result = await confirm({
      title: "Delete invoice?",
      description: `Delete invoice #${invoice.invoiceNumber}?`,
      confirmText: "Delete",
    });

    if (!result) {
      return;
    }
    const prefix =
      invoice.fromEntityId === "self" ? "client-invoices" : "supplier-invoices";
    try {
      await api.del(`/${prefix}/${id}`);
      addAlert("success", "Invoice deleted.");
      navigate(-1);
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  const openItemEdit = (item: InvoiceItem) => {
    setEditItem(item);
    setItemAmount(String(item.amount ?? 0));
  };

  const handleItemUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    const amount = parseFloat(itemAmount);
    if (Number.isNaN(amount)) {
      addAlert("error", "Enter a valid amount.");
      return;
    }
    setItemSubmitting(true);
    try {
      await api.put(`/supplier-invoices/${id}/items/${editItem.id}`, {
        amount: round2(amount),
      });
      addAlert("success", "Item updated.");
      setEditItem(null);
      reload({ quiet: true });
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setItemSubmitting(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;
    setSubmitting(true);
    const prefix =
      invoice.fromEntityId === "self" ? "client-invoices" : "supplier-invoices";
    try {
      await api.put(`/${prefix}/${id}`, { notes });
      addAlert("success", "Invoice updated.");
      setEditOpen(false);
      reload({ quiet: true });
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading />;
  if (!invoice)
    return (
      <p className="py-12 text-center text-muted-foreground">
        Invoice not found.
      </p>
    );

  const hasInvoiceDiscount =
    !!invoice.discountId && (invoice.discountValue ?? 0) > 0;
  const isClientInvoice = invoice.fromEntityId === "self";
  const otherLabel = isClientInvoice ? "To" : "From";
  const otherEntityId = isClientInvoice
    ? invoice.toEntityId
    : invoice.fromEntityId;
  const otherEntityName = isClientInvoice
    ? invoice.toEntityName
    : invoice.fromEntityName;
  const otherHrefPrefix = isClientInvoice ? "/patients" : "/suppliers";
  const canOpenOtherEntity = isClientInvoice
    ? can("patients:read")
    : can("suppliers:read");

  return (
    <div className="space-y-4 flex flex-col">
      <PageHeader
        backHref="/financials"
        title={`Invoice #${invoice.invoiceNumber}`}
        onEdit={can("invoices:write") ? () => setEditOpen(true) : undefined}
        onDelete={can("invoices:delete") ? handleDelete : undefined}
        extraActions={
          can("invoices:read") ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintPdf}
              disabled={pdfLoading}
            >
              <Printer className="size-4 mr-1" />
              {pdfLoading ? "Loading…" : "Print PDF"}
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Details</CardTitle>
        </CardHeader>

        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-3 text-sm">
          <DetailField label={otherLabel}>
            {otherEntityId && canOpenOtherEntity ? (
              <Link
                to={`${otherHrefPrefix}/${otherEntityId}`}
                className="text-sm font-medium capitalize hover:underline"
              >
                {otherEntityName ?? "---"}
              </Link>
            ) : (
              <p className="text-sm font-medium capitalize">
                {otherEntityName ?? "---"}
              </p>
            )}
          </DetailField>
          <DetailField label="Date">
            {beirutDayKey(invoice.createdAt) || "---"}
          </DetailField>
          <DetailField label="Notes" className="sm:col-span-2">
            <MultilineText value={invoice.notes} />
          </DetailField>
          <DetailField label="Created By" className="sm:col-span-2">
            {invoice.createdBy ?? "---"}
          </DetailField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <DataTable
            columns={[
              {
                header: "Type",
                key: "type",
                className: "w-36",
                render: (i) => (
                  <Badge variant="outline" className="text-xs capitalize">
                    {i.itemType ?? "---"}
                  </Badge>
                ),
              },
              {
                header: "Name",
                key: "name",
                className: "w-69",
                render: (i) => {
                  const name =
                    i.itemType === "procedure"
                      ? ([i.categoryName, i.itemName].join(", ") ?? "---")
                      : (i.itemName ?? "---");
                  const href =
                    i.itemType === "product" && can("products:read")
                      ? `/inventory/products/${i.itemId}`
                      : i.itemType === "procedure" && can("procedures:read")
                        ? `/services/procedures/${i.itemId}`
                        : i.itemType === "gift" && can("discounts:read")
                          ? `/financials/discounts/${i.itemId}`
                          : null;
                  return href ? (
                    <Link to={href} className="hover:underline">
                      {name}
                    </Link>
                  ) : (
                    name
                  );
                },
              },
              {
                header: "Notes",
                key: "notes",
                className: "truncate",
                render: (i) => i.notes || "---",
              },
              {
                header: "Quantity",
                key: "quantity",
                className: "w-28",
                render: (i) => i.quantity ?? "---",
              },
              {
                header: "Amount",
                key: "amount",
                className: "w-40 text-right",
                render: (i) => `$${(i.amount ?? 0).toFixed(2)}`,
              },
            ]}
            data={invoice.items || []}
            rowKey={(i) => i.id}
            actions={
              !isClientInvoice && can("invoices:write")
                ? [
                    {
                      label: "Edit Amount",
                      icon: <Pencil className="size-4" />,
                      onClick: openItemEdit,
                    },
                  ]
                : undefined
            }
          />
        </CardContent>
      </Card>

      <Card className="flex flex-col items-end w-fit self-end">
        <CardContent className="flex flex-col items-end gap-2 text-sm w-50">
          {hasInvoiceDiscount && (
            <>
              <div className="flex flex-row justify-between items-center gap-3 w-full">
                <span className="text-muted-foreground">Subtotal</span>
                <span>${(invoice.amount ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex flex-row justify-between items-center gap-3 w-full">
                <span className="text-muted-foreground">Discount</span>
                <span>-${(invoice.discountValue ?? 0).toFixed(2)}</span>
              </div>
            </>
          )}
          <div className="flex flex-row justify-between items-center gap-3 w-full text-lg font-semibold">
            <span className="text-muted-foreground">Total</span>
            <p className="">
              ${(invoice.finalAmount ?? invoice.amount ?? 0).toFixed(2)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Modal
        open={!!editItem}
        onClose={() => setEditItem(null)}
        title="Edit Item Amount"
      >
        <form onSubmit={handleItemUpdate} className="space-y-4">
          <FormField label="Amount">
            {({ id }) => (
              <MoneyInput
                id={id}
                min="0"
                value={itemAmount}
                onChange={(e) => setItemAmount(clampNonNegative(e.target.value))}
                autoFocus
              />
            )}
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditItem(null)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={itemSubmitting}>
              {itemSubmitting ? "Saving…" : "Update"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Invoice"
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <FormField label="Notes">
            {({ id }) => (
              <Input id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />
            )}
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Update"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
