import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/modal";
import { PageHeader } from "@/components/shared/page-header";
import { DetailField } from "@/components/shared/detail-field";
import { Loading } from "@/components/shared/loading";
import { DataTable } from "@/components/data/data-table";
import { api } from "@/lib/api";
import { useAlertStore } from "@/lib/stores/alert-store";
import { getErrorMessage } from "@/lib/utils";
import { usePageTitle } from "@/hooks/use-page-title";
import { usePermissions } from "@/hooks/use-permissions";
import { useConfirm } from "@/hooks/use-confirm";
import type { Invoice } from "@/lib/types";

export default function InvoiceDetailPage() {
  usePageTitle("Invoice");
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addAlert = useAlertStore((s) => s.addAlert);
  const { can } = usePermissions();
  const confirm = useConfirm();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

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

  const load = async () => {
    try {
      const inv = await api.get<Invoice>(`/invoices/${id}`);
      setInvoice(inv);
      setNotes(inv.notes ?? "");
    } catch {
      addAlert("error", "Failed to load invoice.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleDelete = async () => {
    if (!invoice) return;
    const isClientInvoice = invoice.fromEntityId === "self";
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
      load();
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
    : can("inventory:read");

  return (
    <div className="space-y-4 flex flex-col">
      <PageHeader
        backHref="/financials"
        title={`Invoice #${invoice.invoiceNumber}`}
        onEdit={can("transactions:write") ? () => setEditOpen(true) : undefined}
        onDelete={can("transactions:delete") ? handleDelete : undefined}
        extraActions={
          can("transactions:read") ? (
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

        <CardContent className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
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
            {invoice.createdAt?.slice(0, 10) ?? "---"}
          </DetailField>
          <DetailField label="Notes" className="col-span-2">
            {invoice.notes || "---"}
          </DetailField>
          <DetailField label="Created By" className="col-span-2">
            {invoice.createdBy ?? "---"}
          </DetailField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <DataTable
            columns={[
              {
                header: "Type",
                key: "type",
                render: (i) => (
                  <Badge variant="outline" className="text-xs capitalize">
                    {i.itemType ?? "---"}
                  </Badge>
                ),
              },
              {
                header: "Name",
                key: "name",
                render: (i) => i.itemName ?? "---",
              },
              {
                header: "Notes",
                key: "notes",
                render: (i) => i.notes || "---",
              },
              {
                header: "Quantity",
                key: "quantity",
                render: (i) => i.quantity ?? "---",
              },
              {
                header: "Amount",
                key: "amount",
                className: "text-right",
                render: (i) => `$${(i.amount ?? 0).toFixed(2)}`,
              },
            ]}
            data={invoice.items || []}
            rowKey={(i) => i.id}
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
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Invoice"
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
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
